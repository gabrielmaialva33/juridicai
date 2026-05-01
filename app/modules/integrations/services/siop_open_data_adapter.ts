import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import SiopImport from '#modules/siop/models/siop_import'
import SourceRecord from '#modules/siop/models/source_record'
import sourceEvidenceService from '#modules/integrations/services/source_evidence_service'
import type { JsonRecord } from '#shared/types/model_enums'

export const SIOP_OPEN_DATA_LANDING_URL =
  'https://www.gov.br/planejamento/pt-br/assuntos/orcamento/precatorios-content/painel-precatorios/dados-abertos'

export type SiopOpenDataLinkKind = 'budget_history' | 'correction_index' | 'expedition_file'

export type SiopOpenDataLink = {
  kind: SiopOpenDataLinkKind
  title: string
  url: string
  year: number | null
}

export type SiopOpenDataSyncOptions = {
  tenantId: string
  years?: number[]
  fetcher?: typeof fetch
  download?: boolean
}

export type SiopOpenDataSyncItem = {
  link: SiopOpenDataLink
  sourceRecord?: SourceRecord
  siopImport?: SiopImport | null
  sourceRecordCreated?: boolean
  importCreated?: boolean
}

export type SiopOpenDataSyncResult = {
  discovered: number
  selected: number
  downloaded: number
  importsCreated: number
  importsReused: number
  items: SiopOpenDataSyncItem[]
}

class SiopOpenDataAdapter {
  async discover(fetcher: typeof fetch = fetch) {
    const response = await fetcher(SIOP_OPEN_DATA_LANDING_URL)
    if (!response.ok) {
      throw new Error(`SIOP open data discovery failed with HTTP ${response.status}.`)
    }

    return parseSiopOpenDataLinks(await response.text(), SIOP_OPEN_DATA_LANDING_URL)
  }

  async sync(options: SiopOpenDataSyncOptions): Promise<SiopOpenDataSyncResult> {
    const fetcher = options.fetcher ?? fetch
    const discovered = await this.discover(fetcher)
    const selected = selectLinks(discovered, options.years)
    const result: SiopOpenDataSyncResult = {
      discovered: discovered.length,
      selected: selected.length,
      downloaded: 0,
      importsCreated: 0,
      importsReused: 0,
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

      if (item.link.kind !== 'expedition_file' || !item.link.year) {
        continue
      }

      const importResult = await this.findOrCreatePendingImport({
        tenantId: options.tenantId,
        exerciseYear: item.link.year,
        sourceRecord: persisted.sourceRecord,
        metadata: persisted.metadata,
      })
      item.siopImport = importResult.siopImport
      item.importCreated = importResult.created

      if (importResult.created) {
        result.importsCreated += 1
      } else {
        result.importsReused += 1
      }
    }

    return result
  }

  private async persistLink(tenantId: string, link: SiopOpenDataLink, fetcher: typeof fetch) {
    const response = await fetcher(link.url)
    if (!response.ok) {
      throw new Error(`SIOP open data file download failed with HTTP ${response.status}.`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const checksum = createHash('sha256').update(buffer).digest('hex')
    const filename = buildStoredFilename(
      link,
      checksum,
      response.headers.get('content-disposition')
    )
    const directory = app.makePath('storage', 'siop', 'open-data', tenantId)
    const filePath = app.makePath('storage', 'siop', 'open-data', tenantId, filename)
    const metadata = buildMetadata(link)

    await mkdir(directory, { recursive: true })
    await writeFile(filePath, buffer)

    const sourceDatasetId = await sourceEvidenceService.datasetIdByKey('siop-open-data-precatorios')
    const existing = await SourceRecord.query()
      .where('tenant_id', tenantId)
      .where('source', 'siop')
      .where('source_checksum', checksum)
      .first()

    if (existing) {
      existing.merge({
        sourceDatasetId,
        sourceUrl: link.url,
        sourceFilePath: filePath,
        originalFilename: filename,
        mimeType: response.headers.get('content-type'),
        fileSizeBytes: buffer.byteLength,
        rawData: metadata,
      })
      await existing.save()

      return { sourceRecord: existing, created: false, metadata }
    }

    const sourceRecord = await SourceRecord.create({
      tenantId,
      sourceDatasetId,
      source: 'siop',
      sourceUrl: link.url,
      sourceFilePath: filePath,
      sourceChecksum: checksum,
      originalFilename: filename,
      mimeType: response.headers.get('content-type'),
      fileSizeBytes: buffer.byteLength,
      collectedAt: DateTime.now(),
      rawData: metadata,
    })

    return { sourceRecord, created: true, metadata }
  }

  private async findOrCreatePendingImport(input: {
    tenantId: string
    exerciseYear: number
    sourceRecord: SourceRecord
    metadata: JsonRecord
  }) {
    const existing = await SiopImport.query()
      .where('tenant_id', input.tenantId)
      .where('source', 'siop')
      .where('exercise_year', input.exerciseYear)
      .where('source_record_id', input.sourceRecord.id)
      .first()

    if (existing) {
      return { siopImport: existing, created: false }
    }

    const siopImport = await SiopImport.create({
      tenantId: input.tenantId,
      exerciseYear: input.exerciseYear,
      sourceRecordId: input.sourceRecord.id,
      source: 'siop',
      status: 'pending',
      totalRows: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      rawMetadata: input.metadata,
      uploadedByUserId: null,
    })

    return { siopImport, created: true }
  }
}

export function parseSiopOpenDataLinks(html: string, baseUrl: string): SiopOpenDataLink[] {
  const links: SiopOpenDataLink[] = []
  const anchorPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = anchorPattern.exec(html))) {
    const title = decodeHtml(stripTags(match[2])).replace(/\s+/g, ' ').trim()
    const href = decodeHtml(match[1]).trim()
    const link = classifyOpenDataLink(title, href, baseUrl)

    if (link) {
      links.push(link)
    }
  }

  return dedupeLinks(links)
}

function classifyOpenDataLink(
  title: string,
  href: string,
  baseUrl: string
): SiopOpenDataLink | null {
  const expeditionMatch = title.match(/Precatórios expedidos para (\d{4})/i)
  const url = new URL(href, baseUrl).toString()

  if (expeditionMatch) {
    return {
      kind: 'expedition_file',
      title,
      url,
      year: Number(expeditionMatch[1]),
    }
  }

  if (/Série histórica de dados orçamentários/i.test(title)) {
    return {
      kind: 'budget_history',
      title,
      url,
      year: null,
    }
  }

  if (/índice de correção monetária/i.test(title)) {
    return {
      kind: 'correction_index',
      title,
      url,
      year: null,
    }
  }

  return null
}

function selectLinks(links: SiopOpenDataLink[], years?: number[]) {
  if (!years || years.length === 0) {
    return links
  }

  const selectedYears = new Set(years)
  return links.filter(
    (link) => link.kind !== 'expedition_file' || selectedYears.has(link.year ?? 0)
  )
}

function buildMetadata(link: SiopOpenDataLink): JsonRecord {
  return {
    providerId: 'siop-open-data-precatorios',
    sourceKind: link.kind,
    title: link.title,
    year: link.year,
    sourceUrl: link.url,
  }
}

function buildStoredFilename(
  link: SiopOpenDataLink,
  checksum: string,
  contentDisposition: string | null
) {
  const originalFilename =
    filenameFromDisposition(contentDisposition) ?? basename(new URL(link.url).pathname)
  const extension = safeExtension(originalFilename)
  const suffix = link.year ? String(link.year) : slugify(link.kind)

  return `${checksum.slice(0, 16)}-siop-open-data-${suffix}${extension}`
}

function filenameFromDisposition(contentDisposition: string | null) {
  const match = contentDisposition?.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i)
  return match ? decodeURIComponent(match[1]) : null
}

function safeExtension(filename: string) {
  const extension = extname(filename).toLowerCase()
  return /^[.][a-z0-9]{2,8}$/.test(extension) ? extension : '.csv'
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, ' ')
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function dedupeLinks(links: SiopOpenDataLink[]) {
  const seen = new Set<string>()

  return links.filter((link) => {
    const key = `${link.kind}:${link.year ?? 'none'}:${link.url}`
    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

export default new SiopOpenDataAdapter()
