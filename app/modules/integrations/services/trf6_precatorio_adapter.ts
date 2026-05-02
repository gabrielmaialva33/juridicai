import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import sourceEvidenceService from '#modules/integrations/services/source_evidence_service'
import SourceRecord from '#modules/siop/models/source_record'
import type { JsonRecord } from '#shared/types/model_enums'

export const TRF6_FEDERAL_PRECATORIO_URL =
  'https://portal.trf6.jus.br/rpv-e-precatorios/precatorios-federais/'

export type Trf6PrecatorioLinkKind = 'federal_budget_order'

export type Trf6PrecatorioLink = {
  kind: Trf6PrecatorioLinkKind
  title: string
  url: string
  year: number
  pathId: string
}

export type Trf6PrecatorioSyncOptions = {
  tenantId: string
  years?: number[] | null
  limit?: number | null
  fetcher?: typeof fetch
  download?: boolean
}

export type Trf6PrecatorioSyncItem = {
  link: Trf6PrecatorioLink
  sourceRecord?: SourceRecord
  sourceRecordCreated?: boolean
}

export type Trf6PrecatorioSyncResult = {
  discovered: number
  selected: number
  downloaded: number
  items: Trf6PrecatorioSyncItem[]
}

class Trf6PrecatorioAdapter {
  async discover(fetcher: typeof fetch = fetch) {
    const response = await fetcher(TRF6_FEDERAL_PRECATORIO_URL)
    if (!response.ok) {
      throw new Error(`TRF6 precatorio discovery failed with HTTP ${response.status}.`)
    }

    return parseTrf6PrecatorioLinks(await response.text(), TRF6_FEDERAL_PRECATORIO_URL)
  }

  async sync(options: Trf6PrecatorioSyncOptions): Promise<Trf6PrecatorioSyncResult> {
    const fetcher = options.fetcher ?? fetch
    const discovered = await this.discover(fetcher)
    const selected = selectLinks(discovered, options)
    const result: Trf6PrecatorioSyncResult = {
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

  private async persistLink(tenantId: string, link: Trf6PrecatorioLink, fetcher: typeof fetch) {
    const response = await fetcher(link.url)
    if (!response.ok) {
      throw new Error(`TRF6 precatorio file download failed with HTTP ${response.status}.`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentChecksum = createHash('sha256').update(buffer).digest('hex')
    const checksum = createHash('sha256').update(buffer).update(link.url).digest('hex')
    const filename = buildStoredFilename(link, checksum)
    const directory = app.makePath('storage', 'tribunal', 'trf6', tenantId)
    const filePath = app.makePath('storage', 'tribunal', 'trf6', tenantId, filename)
    const metadata = buildMetadata(link, contentChecksum)

    await mkdir(directory, { recursive: true })
    await writeFile(filePath, buffer)

    const sourceDatasetId = await sourceEvidenceService.datasetIdByKey(
      'trf6-federal-precatorio-orders'
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
        mimeType: response.headers.get('content-type') ?? 'application/pdf',
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
      mimeType: response.headers.get('content-type') ?? 'application/pdf',
      fileSizeBytes: buffer.byteLength,
      collectedAt: DateTime.now(),
      rawData: metadata,
    })

    return { sourceRecord, created: true }
  }
}

export function parseTrf6PrecatorioLinks(html: string, baseUrl: string): Trf6PrecatorioLink[] {
  const links: Trf6PrecatorioLink[] = []
  const anchorPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = anchorPattern.exec(html))) {
    const href = decodeHtml(match[1]).trim()
    const title = decodeHtml(stripTags(match[2])).replace(/\s+/g, ' ').trim()
    const year = title.match(/Precat[óo]rios Federais de (20\d{2})/i)?.[1]

    if (!year || !/\.pdf(?:$|\?)/i.test(href)) {
      continue
    }

    links.push({
      kind: 'federal_budget_order',
      title,
      url: new URL(href, baseUrl).toString(),
      year: Number(year),
      pathId: buildPathId(href),
    })
  }

  return dedupeLinks(links)
}

function selectLinks(links: Trf6PrecatorioLink[], options: Trf6PrecatorioSyncOptions) {
  let selected = links

  if (options.years?.length) {
    const years = new Set(options.years)
    selected = selected.filter((link) => years.has(link.year))
  }

  if (options.limit && options.limit > 0) {
    selected = selected.slice(0, Math.trunc(options.limit))
  }

  return selected
}

function buildMetadata(link: Trf6PrecatorioLink, contentChecksum: string): JsonRecord {
  return {
    providerId: 'trf6-federal-precatorio-orders',
    courtAlias: 'trf6',
    sourceKind: link.kind,
    title: link.title,
    year: link.year,
    pathId: link.pathId,
    sourceUrl: link.url,
    contentChecksum,
  }
}

function buildStoredFilename(link: Trf6PrecatorioLink, checksum: string) {
  return `${link.kind}-${link.year}-${link.pathId}-${checksum.slice(0, 12)}.pdf`
}

function buildPathId(href: string) {
  const pathname = new URL(href, TRF6_FEDERAL_PRECATORIO_URL).pathname
  return (
    pathname
      .split('/')
      .filter(Boolean)
      .at(-1)
      ?.replace(/\.pdf$/i, '') ?? stableHash(href)
  )
}

function dedupeLinks(links: Trf6PrecatorioLink[]) {
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

function stableHash(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

export default new Trf6PrecatorioAdapter()
