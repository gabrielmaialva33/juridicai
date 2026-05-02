import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import sourceEvidenceService from '#modules/integrations/services/source_evidence_service'
import SourceRecord from '#modules/siop/models/source_record'
import type { JsonRecord } from '#shared/types/model_enums'

export const TRF3_CNJ_102_PRECATORIO_URL =
  'https://www.trf3.jus.br/transparencia-e-prestacao-de-contas/orcamento/precatorios-e-rpv-trf3r-anexo-ii-da-resolucao-cnj-no-1022009'

export type Trf3PrecatorioFileFormat = 'csv' | 'pdf' | 'xlsx'

export type Trf3PrecatorioLink = {
  kind: 'cnj_102_monthly_report'
  title: string
  url: string
  year: number
  month: number
  monthName: string
  format: Trf3PrecatorioFileFormat
  pathId: string
}

export type Trf3PrecatorioSyncOptions = {
  tenantId: string
  years?: number[] | null
  months?: number[] | null
  formats?: Trf3PrecatorioFileFormat[] | null
  limit?: number | null
  fetcher?: typeof fetch
  download?: boolean
}

export type Trf3PrecatorioSyncItem = {
  link: Trf3PrecatorioLink
  sourceRecord?: SourceRecord
  sourceRecordCreated?: boolean
}

export type Trf3PrecatorioSyncResult = {
  discovered: number
  selected: number
  downloaded: number
  items: Trf3PrecatorioSyncItem[]
}

class Trf3PrecatorioAdapter {
  async discover(fetcher: typeof fetch = fetch) {
    const response = await fetcher(TRF3_CNJ_102_PRECATORIO_URL)
    if (!response.ok) {
      throw new Error(`TRF3 precatorio discovery failed with HTTP ${response.status}.`)
    }

    return parseTrf3PrecatorioLinks(await response.text(), TRF3_CNJ_102_PRECATORIO_URL)
  }

  async sync(options: Trf3PrecatorioSyncOptions): Promise<Trf3PrecatorioSyncResult> {
    const fetcher = options.fetcher ?? fetch
    const discovered = await this.discover(fetcher)
    const selected = selectLinks(discovered, options)
    const result: Trf3PrecatorioSyncResult = {
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

      item.sourceRecord = persisted.sourceRecord
      item.sourceRecordCreated = persisted.created
      result.downloaded += 1
    }

    return result
  }

  private async persistLink(tenantId: string, link: Trf3PrecatorioLink, fetcher: typeof fetch) {
    const response = await fetcher(link.url)
    if (!response.ok) {
      throw new Error(`TRF3 precatorio file download failed with HTTP ${response.status}.`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentChecksum = createHash('sha256').update(buffer).digest('hex')
    const checksum = createHash('sha256').update(buffer).update(link.url).digest('hex')
    const filename = buildStoredFilename(link, checksum)
    const directory = app.makePath('storage', 'tribunal', 'trf3', tenantId)
    const filePath = app.makePath('storage', 'tribunal', 'trf3', tenantId, filename)
    const metadata = buildMetadata(link, contentChecksum)

    await mkdir(directory, { recursive: true })
    await writeFile(filePath, buffer)

    const sourceDatasetId = await sourceEvidenceService.datasetIdByKey(
      'trf3-cnj-102-precatorios-rpv'
    )
    const existing = await SourceRecord.query()
      .where('tenant_id', tenantId)
      .where('source', 'tribunal')
      .where('source_checksum', checksum)
      .first()

    if (existing) {
      existing.merge({
        sourceDatasetId,
        sourceUrl: link.url,
        sourceFilePath: filePath,
        originalFilename: filename,
        mimeType: response.headers.get('content-type') ?? mimeTypeFor(link.format),
        fileSizeBytes: buffer.byteLength,
        rawData: metadata,
      })
      await existing.save()

      return { sourceRecord: existing, created: false }
    }

    const sourceRecord = await SourceRecord.create({
      tenantId,
      sourceDatasetId,
      source: 'tribunal',
      sourceUrl: link.url,
      sourceFilePath: filePath,
      sourceChecksum: checksum,
      originalFilename: filename,
      mimeType: response.headers.get('content-type') ?? mimeTypeFor(link.format),
      fileSizeBytes: buffer.byteLength,
      collectedAt: DateTime.now(),
      rawData: metadata,
    })

    return { sourceRecord, created: true }
  }
}

export function parseTrf3PrecatorioLinks(html: string, baseUrl: string): Trf3PrecatorioLink[] {
  const links: Trf3PrecatorioLink[] = []
  const anchorPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = anchorPattern.exec(html))) {
    const href = decodeHtml(match[1]).trim()
    const label = decodeHtml(stripTags(match[2])).replace(/\s+/g, ' ').trim()
    const format = formatFrom(label, href)

    if (!format) {
      continue
    }

    const context = html.slice(Math.max(0, match.index - 1_500), match.index)
    const year = lastYearBefore(context)
    const month = lastMonthBefore(context)

    if (!year || !month) {
      continue
    }

    const url = new URL(href, baseUrl).toString()

    links.push({
      kind: 'cnj_102_monthly_report',
      title: `TRF3 Anexo II CNJ 102/2009 ${month.name} ${year} ${format.toUpperCase()}`,
      url,
      year,
      month: month.value,
      monthName: month.name,
      format,
      pathId: buildPathId(url),
    })
  }

  return dedupeLinks(links)
}

function selectLinks(links: Trf3PrecatorioLink[], options: Trf3PrecatorioSyncOptions) {
  let selected = links

  if (options.years?.length) {
    const years = new Set(options.years)
    selected = selected.filter((link) => years.has(link.year))
  }

  if (options.months?.length) {
    const months = new Set(options.months)
    selected = selected.filter((link) => months.has(link.month))
  }

  if (options.formats?.length) {
    const formats = new Set(options.formats)
    selected = selected.filter((link) => formats.has(link.format))
  }

  if (options.limit && options.limit > 0) {
    selected = selected.slice(0, Math.trunc(options.limit))
  }

  return selected
}

function formatFrom(label: string, href: string): Trf3PrecatorioFileFormat | null {
  const value = `${label} ${href}`.toLowerCase()

  if (/\bcsv\b|\.csv(?:$|\?)/i.test(value)) {
    return 'csv'
  }

  if (/\bxlsx\b|\.xlsx(?:$|\?)/i.test(value)) {
    return 'xlsx'
  }

  if (/\bpdf\b|\.pdf(?:$|\?)/i.test(value)) {
    return 'pdf'
  }

  return null
}

function lastYearBefore(html: string) {
  const text = stripTags(html)
  const matches = [...text.matchAll(/\b(20\d{2})\b/g)]
  const value = matches.at(-1)?.[1]

  return value ? Number(value) : null
}

function lastMonthBefore(html: string) {
  const text = stripTags(html).toLowerCase()
  let found: { name: string; value: number; index: number } | null = null

  for (const month of MONTHS) {
    const index = text.lastIndexOf(month.normalized)

    if (index > -1 && (!found || index > found.index)) {
      found = { name: month.name, value: month.value, index }
    }
  }

  return found
}

function buildMetadata(link: Trf3PrecatorioLink, contentChecksum: string): JsonRecord {
  return {
    providerId: 'trf3-cnj-102-precatorios-rpv',
    courtAlias: 'trf3',
    sourceKind: link.kind,
    year: link.year,
    month: link.month,
    monthName: link.monthName,
    format: link.format,
    title: link.title,
    pathId: link.pathId,
    sourceUrl: link.url,
    contentChecksum,
  }
}

function buildStoredFilename(link: Trf3PrecatorioLink, checksum: string) {
  return `${link.kind}-${link.year}-${String(link.month).padStart(2, '0')}-${link.format}-${checksum.slice(0, 12)}-${safeBasename(link)}`
}

function safeBasename(link: Trf3PrecatorioLink) {
  const name = basename(new URL(link.url).pathname)

  return name || `${link.pathId}.${link.format}`
}

function buildPathId(url: string) {
  const parsedUrl = new URL(url)
  const candidate = basename(parsedUrl.pathname).replace(/\.(csv|pdf|xlsx)$/i, '')

  return candidate || stableHash(url)
}

function dedupeLinks(links: Trf3PrecatorioLink[]) {
  const seen = new Set<string>()

  return links.filter((link) => {
    const key = `${link.url}:${link.format}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, ' ')
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function stableHash(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

function mimeTypeFor(format: Trf3PrecatorioFileFormat) {
  if (format === 'csv') {
    return 'text/csv'
  }

  if (format === 'xlsx') {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }

  return 'application/pdf'
}

const MONTHS = [
  { name: 'Janeiro', normalized: 'janeiro', value: 1 },
  { name: 'Fevereiro', normalized: 'fevereiro', value: 2 },
  { name: 'Março', normalized: 'março', value: 3 },
  { name: 'Marco', normalized: 'marco', value: 3 },
  { name: 'Abril', normalized: 'abril', value: 4 },
  { name: 'Maio', normalized: 'maio', value: 5 },
  { name: 'Junho', normalized: 'junho', value: 6 },
  { name: 'Julho', normalized: 'julho', value: 7 },
  { name: 'Agosto', normalized: 'agosto', value: 8 },
  { name: 'Setembro', normalized: 'setembro', value: 9 },
  { name: 'Outubro', normalized: 'outubro', value: 10 },
  { name: 'Novembro', normalized: 'novembro', value: 11 },
  { name: 'Dezembro', normalized: 'dezembro', value: 12 },
] as const

export default new Trf3PrecatorioAdapter()
