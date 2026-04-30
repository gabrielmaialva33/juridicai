import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import SourceRecord from '#modules/siop/models/source_record'
import { normalizeCnj } from '#modules/siop/parsers/cnj_parser'
import { parseBrazilianMoney } from '#modules/siop/parsers/value_parser'
import type { JsonRecord } from '#shared/types/model_enums'

export const TRF2_PRECATORIO_LANDING_URL =
  'https://www.trf2.jus.br/trf2/consultas-e-servicos/precatorios-federais-requisicoes-de-pequeno-valor-rpvs'

export type Trf2PrecatorioLinkKind = 'annual_debt_map' | 'paid_precatorios'

export type Trf2PrecatorioLink = {
  kind: Trf2PrecatorioLinkKind
  title: string
  url: string
  year: number | null
}

export type Trf2PrecatorioRow = {
  chronologicalOrder: number | null
  proposalYear: number | null
  legalBasis: string | null
  precatorioNumber: string | null
  cnjNumber: string | null
  beneficiaryDocumentMasked: string | null
  autuadoAt: string | null
  updatedUntil: string | null
  parcelValue: string | null
  originalPaidValue: string | null
  paidAt: string | null
  paidValue: string | null
  rawData: JsonRecord
}

export type Trf2PrecatorioSyncOptions = {
  tenantId: string
  years?: number[]
  fetcher?: typeof fetch
  download?: boolean
}

export type Trf2PrecatorioSyncItem = {
  link: Trf2PrecatorioLink
  sourceRecord?: SourceRecord
  sourceRecordCreated?: boolean
  parsedRows?: number
  validCnjRows?: number
  uniqueCnjNumbers?: number
}

export type Trf2PrecatorioSyncResult = {
  discovered: number
  selected: number
  downloaded: number
  items: Trf2PrecatorioSyncItem[]
}

class Trf2PrecatorioAdapter {
  async discover(fetcher: typeof fetch = fetch) {
    const response = await fetcher(TRF2_PRECATORIO_LANDING_URL)
    if (!response.ok) {
      throw new Error(`TRF2 precatorio discovery failed with HTTP ${response.status}.`)
    }

    return parseTrf2PrecatorioLinks(await response.text(), TRF2_PRECATORIO_LANDING_URL)
  }

  async sync(options: Trf2PrecatorioSyncOptions): Promise<Trf2PrecatorioSyncResult> {
    const fetcher = options.fetcher ?? fetch
    const discovered = await this.discover(fetcher)
    const selected = selectLinks(discovered, options.years)
    const result: Trf2PrecatorioSyncResult = {
      discovered: discovered.length,
      selected: selected.length,
      downloaded: 0,
      items: selected.map((link) => ({ link })),
    }

    if (options.download === false) {
      return result
    }

    for (const item of result.items) {
      const persisted = await this.persistLink(options.tenantId, item.link, fetcher)
      const parsedRows =
        item.link.kind === 'paid_precatorios' ? parseTrf2ChronologicalCsv(persisted.contents) : []

      item.sourceRecord = persisted.sourceRecord
      item.sourceRecordCreated = persisted.created
      item.parsedRows = parsedRows.length
      item.validCnjRows = parsedRows.filter((row) => row.cnjNumber).length
      item.uniqueCnjNumbers = new Set(parsedRows.map((row) => row.cnjNumber).filter(Boolean)).size
      result.downloaded += 1
    }

    return result
  }

  private async persistLink(tenantId: string, link: Trf2PrecatorioLink, fetcher: typeof fetch) {
    const response = await fetcher(link.url)
    if (!response.ok) {
      throw new Error(`TRF2 precatorio file download failed with HTTP ${response.status}.`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const checksum = createHash('sha256').update(buffer).digest('hex')
    const filename = buildStoredFilename(link, checksum)
    const directory = app.makePath('storage', 'tribunal', 'trf2', tenantId)
    const filePath = app.makePath('storage', 'tribunal', 'trf2', tenantId, filename)
    const metadata = buildMetadata(link)

    await mkdir(directory, { recursive: true })
    await writeFile(filePath, buffer)

    const existing = await SourceRecord.query()
      .where('tenant_id', tenantId)
      .where('source', 'tribunal')
      .where('source_checksum', checksum)
      .first()

    if (existing) {
      existing.merge({
        sourceUrl: link.url,
        sourceFilePath: filePath,
        originalFilename: filename,
        mimeType: response.headers.get('content-type'),
        fileSizeBytes: buffer.byteLength,
        rawData: metadata,
      })
      await existing.save()

      return { sourceRecord: existing, created: false, contents: decodeCsv(buffer) }
    }

    const sourceRecord = await SourceRecord.create({
      tenantId,
      source: 'tribunal',
      sourceUrl: link.url,
      sourceFilePath: filePath,
      sourceChecksum: checksum,
      originalFilename: filename,
      mimeType: response.headers.get('content-type'),
      fileSizeBytes: buffer.byteLength,
      collectedAt: DateTime.now(),
      rawData: metadata,
    })

    return { sourceRecord, created: true, contents: decodeCsv(buffer) }
  }
}

export function parseTrf2PrecatorioLinks(html: string, baseUrl: string): Trf2PrecatorioLink[] {
  const links: Trf2PrecatorioLink[] = []
  const anchorPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = anchorPattern.exec(html))) {
    const title = decodeHtml(stripTags(match[2])).replace(/\s+/g, ' ').trim()
    const href = decodeHtml(match[1]).trim()
    const link = classifyTrf2PrecatorioLink(title, href, baseUrl)

    if (link) {
      links.push(link)
    }
  }

  return dedupeLinks(links)
}

export function parseTrf2ChronologicalCsv(contents: string | Buffer): Trf2PrecatorioRow[] {
  const text = typeof contents === 'string' ? contents : decodeCsv(contents)
  const lines = text.split(/\r?\n/)
  const headerIndex = lines.findIndex((line) =>
    normalizeHeaderLine(line).includes('numero_do_precatorio')
  )

  if (headerIndex === -1) {
    return []
  }

  const headers = splitDelimitedLine(lines[headerIndex], ';').map(normalizeHeader)
  const rows: Trf2PrecatorioRow[] = []

  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim()) {
      continue
    }

    const values = splitDelimitedLine(line, ';')
    const rawData = headers.reduce<JsonRecord>((payload, header, index) => {
      payload[header] = values[index]?.trim() || null
      return payload
    }, {})

    if (!Object.values(rawData).some(Boolean)) {
      continue
    }

    const precatorioNumber = stringField(rawData.numero_do_precatorio)

    rows.push({
      chronologicalOrder: numberField(rawData.n_de_ordem_cronologica),
      proposalYear: numberField(rawData.proposta),
      legalBasis: stringField(rawData.base_legal_para_enquadramento_na_ordem_cronologica),
      precatorioNumber,
      cnjNumber: normalizeCnj(precatorioNumber),
      beneficiaryDocumentMasked: stringField(rawData.cpf_cnpj_parcial_do_beneficiario),
      autuadoAt: stringField(rawData.data_de_autuacao_no_trf2),
      updatedUntil: stringField(rawData.atualizado_ate),
      parcelValue: parseBrazilianMoney(stringField(rawData.parcela_devida)),
      originalPaidValue: parseBrazilianMoney(stringField(rawData.valor_original_pago)),
      paidAt: stringField(rawData.data_pagamento),
      paidValue: parseBrazilianMoney(stringField(rawData.valor_pago)),
      rawData,
    })
  }

  return rows
}

function classifyTrf2PrecatorioLink(
  title: string,
  href: string,
  baseUrl: string
): Trf2PrecatorioLink | null {
  if (!/\.csv(?:$|\?)/i.test(href)) {
    return null
  }

  const url = new URL(href, baseUrl).toString()
  const annualDebtMatch = title.match(/Mapa anual da dívida de (\d{4}) em CSV/i)
  if (annualDebtMatch) {
    return {
      kind: 'annual_debt_map',
      title,
      url,
      year: Number(annualDebtMatch[1]),
    }
  }

  const paidMatch = title.match(/Precatórios pagos na proposta de (\d{4})(?:-\d{4})? em CSV/i)
  if (paidMatch) {
    return {
      kind: 'paid_precatorios',
      title,
      url,
      year: Number(paidMatch[1]),
    }
  }

  return null
}

function selectLinks(links: Trf2PrecatorioLink[], years?: number[]) {
  if (!years || years.length === 0) {
    return links
  }

  const selectedYears = new Set(years)
  return links.filter((link) => selectedYears.has(link.year ?? 0))
}

function buildMetadata(link: Trf2PrecatorioLink): JsonRecord {
  return {
    providerId: 'trf2-precatorios',
    courtAlias: 'trf2',
    sourceKind: link.kind,
    title: link.title,
    year: link.year,
    sourceUrl: link.url,
  }
}

function buildStoredFilename(link: Trf2PrecatorioLink, checksum: string) {
  const originalFilename = basename(new URL(link.url).pathname)
  const suffix = link.year ? String(link.year) : link.kind
  const hash = checksum.slice(0, 12)

  return `${suffix}-${hash}-${originalFilename}`
}

function decodeCsv(buffer: Buffer) {
  return new TextDecoder('windows-1252').decode(buffer)
}

function normalizeHeaderLine(line: string) {
  return splitDelimitedLine(line, ';').map(normalizeHeader).join(';')
}

function normalizeHeader(header: string) {
  return header
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function stringField(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberField(value: unknown) {
  const text = stringField(value)
  if (!text) {
    return null
  }

  const parsed = Number(text.replace(/\D/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function splitDelimitedLine(line: string, delimiter: string) {
  const values: string[] = []
  let current = ''
  let quoted = false

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted
      continue
    }

    if (char === delimiter && !quoted) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values
}

function dedupeLinks(links: Trf2PrecatorioLink[]) {
  const seen = new Set<string>()

  return links.filter((link) => {
    if (seen.has(link.url)) {
      return false
    }

    seen.add(link.url)
    return true
  })
}

function stripTags(input: string) {
  return input.replace(/<[^>]*>/g, '')
}

function decodeHtml(input: string) {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

export default new Trf2PrecatorioAdapter()
