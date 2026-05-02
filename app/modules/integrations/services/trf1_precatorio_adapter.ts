import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import sourceEvidenceService from '#modules/integrations/services/source_evidence_service'
import SourceRecord from '#modules/siop/models/source_record'
import type { JsonRecord } from '#shared/types/model_enums'

export const TRF1_PRECATORIO_PAGE_URL =
  'https://www.trf1.jus.br/trf1/rpv-e-precatorios/rpv-e-precatorioss'

export type Trf1PrecatorioLinkKind =
  | 'federal_budget_proposal'
  | 'federal_debt_map'
  | 'subnational_budget_proposal'
  | 'subnational_repasses'
  | 'subnational_consolidated_debt'
  | 'subnational_debt_map'

export type Trf1PrecatorioLink = {
  kind: Trf1PrecatorioLinkKind
  title: string
  url: string
  year: number | null
  pathId: string
}

export type Trf1PrecatorioSyncOptions = {
  tenantId: string
  years?: number[] | null
  kinds?: Trf1PrecatorioLinkKind[] | null
  limit?: number | null
  fetcher?: typeof fetch
  download?: boolean
}

export type Trf1PrecatorioSyncItem = {
  link: Trf1PrecatorioLink
  sourceRecord?: SourceRecord
  sourceRecordCreated?: boolean
}

export type Trf1PrecatorioSyncResult = {
  discovered: number
  selected: number
  downloaded: number
  items: Trf1PrecatorioSyncItem[]
}

class Trf1PrecatorioAdapter {
  async discover(fetcher: typeof fetch = fetch) {
    const response = await fetcher(TRF1_PRECATORIO_PAGE_URL)
    if (!response.ok) {
      throw new Error(`TRF1 precatorio discovery failed with HTTP ${response.status}.`)
    }

    return parseTrf1PrecatorioLinks(await response.text(), TRF1_PRECATORIO_PAGE_URL)
  }

  async sync(options: Trf1PrecatorioSyncOptions): Promise<Trf1PrecatorioSyncResult> {
    const fetcher = options.fetcher ?? fetch
    const discovered = await this.discover(fetcher)
    const selected = selectLinks(discovered, options)
    const result: Trf1PrecatorioSyncResult = {
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

  private async persistLink(tenantId: string, link: Trf1PrecatorioLink, fetcher: typeof fetch) {
    const response = await fetcher(link.url)
    if (!response.ok) {
      throw new Error(`TRF1 precatorio file download failed with HTTP ${response.status}.`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentChecksum = createHash('sha256').update(buffer).digest('hex')
    const checksum = createHash('sha256').update(buffer).update(link.url).digest('hex')
    const filename = buildStoredFilename(link, checksum)
    const directory = app.makePath('storage', 'tribunal', 'trf1', tenantId)
    const filePath = app.makePath('storage', 'tribunal', 'trf1', tenantId, filename)
    const metadata = buildMetadata(link, contentChecksum)

    await mkdir(directory, { recursive: true })
    await writeFile(filePath, buffer)

    const sourceDatasetId = await sourceEvidenceService.datasetIdByKey('trf1-precatorio-reports')
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
        mimeType: response.headers.get('content-type') ?? 'application/octet-stream',
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
      mimeType: response.headers.get('content-type') ?? 'application/octet-stream',
      fileSizeBytes: buffer.byteLength,
      collectedAt: DateTime.now(),
      rawData: metadata,
    })

    return { sourceRecord, created: true }
  }
}

export function parseTrf1PrecatorioLinks(html: string, baseUrl: string): Trf1PrecatorioLink[] {
  const links: Trf1PrecatorioLink[] = []
  const anchorPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = anchorPattern.exec(html))) {
    const href = decodeHtml(match[1]).trim()
    const title = decodeHtml(stripTags(match[2])).replace(/\s+/g, ' ').trim()
    const section = sectionBefore(html.slice(Math.max(0, match.index - 2_000), match.index))
    const kind = classifyTrf1Link(title, section)

    if (!kind) {
      continue
    }

    const url = new URL(href, baseUrl).toString()

    links.push({
      kind,
      title,
      url,
      year: yearFromTitle(title),
      pathId: buildPathId(url),
    })
  }

  return dedupeLinks(links)
}

function classifyTrf1Link(
  title: string,
  section: 'federal' | 'subnational' | null
): Trf1PrecatorioLinkKind | null {
  const normalized = normalizeText(title)

  if (normalized.includes('proposta de') && normalized.includes('art 12')) {
    return 'federal_budget_proposal'
  }

  if (
    section !== 'subnational' &&
    normalized.includes('mapa da situacao da divida') &&
    normalized.includes('referencia')
  ) {
    return 'federal_debt_map'
  }

  if (normalized.includes('proposta de') && normalized.includes('art 85')) {
    return 'subnational_budget_proposal'
  }

  if (normalized.includes('repasses entidades devedoras estaduais e municipais')) {
    return 'subnational_repasses'
  }

  if (normalized.includes('divida consolidada ate')) {
    return 'subnational_consolidated_debt'
  }

  if (
    section === 'subnational' &&
    normalized.includes('mapa da situacao da divida de precatorios')
  ) {
    return 'subnational_debt_map'
  }

  return null
}

function sectionBefore(html: string) {
  const normalized = normalizeText(stripTags(html))
  const federalIndex = normalized.lastIndexOf('precatorios federais')
  const subnationalIndex = normalized.lastIndexOf('precatorios de entes subnacionais')

  if (subnationalIndex > federalIndex) {
    return 'subnational' as const
  }

  if (federalIndex > -1) {
    return 'federal' as const
  }

  return null
}

function selectLinks(links: Trf1PrecatorioLink[], options: Trf1PrecatorioSyncOptions) {
  let selected = links

  if (options.years?.length) {
    const years = new Set(options.years)
    selected = selected.filter((link) => link.year && years.has(link.year))
  }

  if (options.kinds?.length) {
    const kinds = new Set(options.kinds)
    selected = selected.filter((link) => kinds.has(link.kind))
  }

  if (options.limit && options.limit > 0) {
    selected = selected.slice(0, Math.trunc(options.limit))
  }

  return selected
}

function buildMetadata(link: Trf1PrecatorioLink, contentChecksum: string): JsonRecord {
  return {
    providerId: 'trf1-precatorio-reports',
    courtAlias: 'trf1',
    sourceKind: link.kind,
    title: link.title,
    year: link.year,
    pathId: link.pathId,
    sourceUrl: link.url,
    contentChecksum,
  }
}

function buildStoredFilename(link: Trf1PrecatorioLink, checksum: string) {
  return `${link.kind}-${link.year ?? 'unknown'}-${link.pathId}-${checksum.slice(0, 12)}${fileExtension(link.url)}`
}

function buildPathId(url: string) {
  const parsedUrl = new URL(url)
  const name = basename(parsedUrl.pathname).replace(/\.[a-z0-9]+$/i, '')

  return name || stableHash(url)
}

function fileExtension(url: string) {
  const extension = basename(new URL(url).pathname).match(/\.[a-z0-9]+$/i)?.[0]

  return extension ?? ''
}

function yearFromTitle(title: string) {
  const match = title.match(/\b(20\d{2})\b/)

  return match ? Number(match[1]) : null
}

function dedupeLinks(links: Trf1PrecatorioLink[]) {
  const seen = new Set<string>()

  return links.filter((link) => {
    if (seen.has(link.url)) {
      return false
    }

    seen.add(link.url)
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

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .toLowerCase()
}

function stableHash(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

export default new Trf1PrecatorioAdapter()
