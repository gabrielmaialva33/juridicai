import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import SourceRecord from '#modules/siop/models/source_record'
import sourceEvidenceService from '#modules/integrations/services/source_evidence_service'
import type { JsonRecord } from '#shared/types/model_enums'

export const TJSP_PRECATORIO_COMMUNICATIONS_URL = 'https://www.tjsp.jus.br/Precatorios/Comunicados'

export const TJSP_PRECATORIO_LIST_URL = 'https://www.tjsp.jus.br/Precatorios/Precatorios/ListaGeral'

export const TJSP_PRECATORIO_DATASET_KEY = 'tjsp-precatorio-communications'

export type TjspPrecatorioCommunicationCategory =
  | 'state_entities'
  | 'municipal_entities'
  | 'inss'
  | 'statistics'

export type TjspPrecatorioCommunicationLink = {
  category: TjspPrecatorioCommunicationCategory
  title: string
  summary: string | null
  url: string
  publishedAt: string | null
  communicationCode: string | null
  page: number | null
}

export type TjspPrecatorioDocumentLink = {
  title: string
  url: string
  format: string | null
  externalCode: string | null
}

export type TjspPrecatorioCommunicationDetail = {
  title: string | null
  summary: string | null
  publishedAt: string | null
  documentLinks: TjspPrecatorioDocumentLink[]
  text: string | null
}

export type TjspPrecatorioCommunicationSyncOptions = {
  tenantId: string
  categories?: TjspPrecatorioCommunicationCategory[]
  fetcher?: typeof fetch
  downloadDetails?: boolean
  downloadDocuments?: boolean
  limit?: number
}

export type TjspPrecatorioCommunicationSyncItem = {
  link: TjspPrecatorioCommunicationLink
  detail?: TjspPrecatorioCommunicationDetail
  sourceRecord?: SourceRecord
  sourceRecordCreated?: boolean
  documentSourceRecords?: SourceRecord[]
  documentSourceRecordsCreated?: number
}

export type TjspPrecatorioCommunicationSyncResult = {
  discovered: number
  selected: number
  persisted: number
  documentLinks: number
  items: TjspPrecatorioCommunicationSyncItem[]
}

const CATEGORY_DESTINATION_CODES: Record<TjspPrecatorioCommunicationCategory, string> = {
  state_entities: '112',
  municipal_entities: '113',
  inss: '126',
  statistics: '154',
}

class TjspPrecatorioCommunicationsAdapter {
  async discover(fetcher: typeof fetch = fetch, categories = defaultCategories()) {
    const links: TjspPrecatorioCommunicationLink[] = []

    for (const category of categories) {
      const url = categoryUrl(category)
      const response = await fetcher(url)
      if (!response.ok) {
        throw new Error(
          `TJSP precatorio communication discovery failed for ${category} with HTTP ${response.status}.`
        )
      }

      links.push(...parseTjspCommunicationLinks(await response.text(), category, url))
    }

    return dedupeCommunicationLinks(links)
  }

  async sync(
    options: TjspPrecatorioCommunicationSyncOptions
  ): Promise<TjspPrecatorioCommunicationSyncResult> {
    const fetcher = options.fetcher ?? fetch
    const discovered = await this.discover(fetcher, options.categories ?? defaultCategories())
    const selected =
      typeof options.limit === 'number' ? discovered.slice(0, options.limit) : discovered
    const result: TjspPrecatorioCommunicationSyncResult = {
      discovered: discovered.length,
      selected: selected.length,
      persisted: 0,
      documentLinks: 0,
      items: selected.map((link) => ({ link })),
    }

    if (options.downloadDetails === false) {
      return result
    }

    for (const item of result.items) {
      const detailResponse = await fetcher(item.link.url)
      if (!detailResponse.ok) {
        throw new Error(
          `TJSP precatorio communication detail failed for ${item.link.url} with HTTP ${detailResponse.status}.`
        )
      }

      const html = await detailResponse.text()
      const detail = parseTjspCommunicationDetail(html, item.link.url)
      const persisted = await this.upsertSourceRecord({
        tenantId: options.tenantId,
        link: item.link,
        detail,
        html,
        mimeType: detailResponse.headers.get('content-type'),
      })

      item.detail = detail
      item.sourceRecord = persisted.sourceRecord
      item.sourceRecordCreated = persisted.created
      result.persisted += 1
      result.documentLinks += detail.documentLinks.length

      if (options.downloadDocuments !== false) {
        const documentRecords = await this.persistDocuments({
          tenantId: options.tenantId,
          link: item.link,
          documents: detail.documentLinks,
          fetcher,
        })

        item.documentSourceRecords = documentRecords.map((record) => record.sourceRecord)
        item.documentSourceRecordsCreated = documentRecords.filter(
          (record) => record.created
        ).length
        result.persisted += documentRecords.length
      }
    }

    return result
  }

  private async persistDocuments(input: {
    tenantId: string
    link: TjspPrecatorioCommunicationLink
    documents: TjspPrecatorioDocumentLink[]
    fetcher: typeof fetch
  }) {
    const records: Array<{ sourceRecord: SourceRecord; created: boolean }> = []

    for (const document of input.documents) {
      const response = await input.fetcher(document.url)
      if (!response.ok) {
        throw new Error(
          `TJSP precatorio document download failed for ${document.url} with HTTP ${response.status}.`
        )
      }

      records.push(
        await this.upsertDocumentSourceRecord({
          tenantId: input.tenantId,
          link: input.link,
          document,
          buffer: Buffer.from(await response.arrayBuffer()),
          mimeType: response.headers.get('content-type'),
        })
      )
    }

    return records
  }

  private async upsertSourceRecord(input: {
    tenantId: string
    link: TjspPrecatorioCommunicationLink
    detail: TjspPrecatorioCommunicationDetail
    html: string
    mimeType: string | null
  }) {
    const checksum = createHash('sha256')
      .update(
        JSON.stringify({
          providerId: TJSP_PRECATORIO_DATASET_KEY,
          sourceUrl: input.link.url,
          detailHash: createHash('sha256').update(input.html).digest('hex'),
        })
      )
      .digest('hex')
    const sourceDatasetId = await sourceEvidenceService.datasetIdByKey(TJSP_PRECATORIO_DATASET_KEY)
    const rawData = buildMetadata(input.link, input.detail)
    const existing = await SourceRecord.query()
      .where('tenant_id', input.tenantId)
      .where('source', 'tribunal')
      .where('source_checksum', checksum)
      .first()

    if (existing) {
      existing.merge({
        sourceDatasetId,
        sourceUrl: input.link.url,
        mimeType: input.mimeType,
        rawData,
      })
      await existing.save()

      return { sourceRecord: existing, created: false }
    }

    const sourceRecord = await SourceRecord.create({
      tenantId: input.tenantId,
      sourceDatasetId,
      source: 'tribunal',
      sourceUrl: input.link.url,
      sourceChecksum: checksum,
      mimeType: input.mimeType,
      collectedAt: DateTime.now(),
      rawData,
    })

    return { sourceRecord, created: true }
  }

  private async upsertDocumentSourceRecord(input: {
    tenantId: string
    link: TjspPrecatorioCommunicationLink
    document: TjspPrecatorioDocumentLink
    buffer: Buffer
    mimeType: string | null
  }) {
    const checksum = createHash('sha256').update(input.buffer).digest('hex')
    const sourceDatasetId = await sourceEvidenceService.datasetIdByKey(TJSP_PRECATORIO_DATASET_KEY)
    const filename = buildDocumentFilename(input.link, input.document, input.mimeType, checksum)
    const directory = app.makePath('storage', 'tribunal', 'tjsp', input.tenantId)
    const filePath = app.makePath('storage', 'tribunal', 'tjsp', input.tenantId, filename)
    const rawData = buildDocumentMetadata(input.link, input.document)
    const existing = await SourceRecord.query()
      .where('tenant_id', input.tenantId)
      .where('source', 'tribunal')
      .where('source_checksum', checksum)
      .first()

    await mkdir(directory, { recursive: true })
    await writeFile(filePath, input.buffer)

    if (existing) {
      existing.merge({
        sourceDatasetId,
        sourceUrl: input.document.url,
        sourceFilePath: filePath,
        originalFilename: filename,
        mimeType: input.mimeType,
        fileSizeBytes: input.buffer.byteLength,
        rawData,
      })
      await existing.save()

      return { sourceRecord: existing, created: false }
    }

    const sourceRecord = await SourceRecord.create({
      tenantId: input.tenantId,
      sourceDatasetId,
      source: 'tribunal',
      sourceUrl: input.document.url,
      sourceFilePath: filePath,
      sourceChecksum: checksum,
      originalFilename: filename,
      mimeType: input.mimeType,
      fileSizeBytes: input.buffer.byteLength,
      collectedAt: DateTime.now(),
      rawData,
    })

    return { sourceRecord, created: true }
  }
}

export function parseTjspCommunicationLinks(
  html: string,
  category: TjspPrecatorioCommunicationCategory,
  baseUrl: string
): TjspPrecatorioCommunicationLink[] {
  const links: TjspPrecatorioCommunicationLink[] = []
  const blockPattern =
    /<div\s+class=["']lista-comunicados["'][^>]*>([\s\S]*?)(?=<div\s+class=["']lista-comunicados["']|<div\s+class=["']col-md-3|<\/section>|$)/gi
  let blockMatch: RegExpExecArray | null

  while ((blockMatch = blockPattern.exec(html))) {
    const block = blockMatch[1]
    const href = firstMatch(
      block,
      /href=["']([^"']*\/Precatorios\/Comunicados\/Comunicado[^"']*)["']/i
    )

    if (!href) {
      continue
    }

    const url = new URL(decodeHtml(href), baseUrl)
    const titleHtml = firstMatch(block, /<h3[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/i) ?? ''
    const title = compactText(stripTags(titleHtml))

    if (!title) {
      continue
    }

    links.push({
      category,
      title,
      summary: extractFirstParagraph(block),
      url: url.toString(),
      publishedAt: parseBrazilianDate(firstMatch(block, /<time[^>]*>([\s\S]*?)<\/time>/i)),
      communicationCode: url.searchParams.get('codigoComunicado'),
      page: numberOrNull(url.searchParams.get('pagina')),
    })
  }

  return dedupeCommunicationLinks(links)
}

export function parseTjspCommunicationDetail(
  html: string,
  baseUrl: string
): TjspPrecatorioCommunicationDetail {
  return {
    title: extractDetailTitle(html),
    summary: extractFirstParagraph(html),
    publishedAt: parseBrazilianDate(firstMatch(html, /<time[^>]*>([\s\S]*?)<\/time>/i)),
    documentLinks: extractDocumentLinks(html, baseUrl),
    text: compactText(stripTags(extractCommunicationBody(html) ?? html)).slice(0, 10000) || null,
  }
}

function buildMetadata(
  link: TjspPrecatorioCommunicationLink,
  detail: TjspPrecatorioCommunicationDetail
): JsonRecord {
  return {
    providerId: TJSP_PRECATORIO_DATASET_KEY,
    courtAlias: 'tjsp',
    stateCode: 'SP',
    category: link.category,
    communicationCode: link.communicationCode,
    page: link.page,
    title: detail.title ?? link.title,
    summary: detail.summary ?? link.summary,
    publishedAt: detail.publishedAt ?? link.publishedAt,
    sourceUrl: link.url,
    documentLinks: detail.documentLinks,
    text: detail.text,
  }
}

function buildDocumentMetadata(
  link: TjspPrecatorioCommunicationLink,
  document: TjspPrecatorioDocumentLink
): JsonRecord {
  return {
    providerId: TJSP_PRECATORIO_DATASET_KEY,
    courtAlias: 'tjsp',
    stateCode: 'SP',
    recordKind: 'attached_document',
    category: link.category,
    communicationCode: link.communicationCode,
    communicationUrl: link.url,
    title: document.title,
    format: document.format,
    externalCode: document.externalCode,
    sourceUrl: document.url,
  }
}

function buildDocumentFilename(
  link: TjspPrecatorioCommunicationLink,
  document: TjspPrecatorioDocumentLink,
  mimeType: string | null,
  checksum: string
) {
  const code = document.externalCode ?? link.communicationCode ?? 'document'
  const extension = documentExtension(document, mimeType)
  return `${link.category}-${code}-${checksum.slice(0, 12)}.${extension}`
}

function documentExtension(document: TjspPrecatorioDocumentLink, mimeType: string | null) {
  const urlExtension = extname(new URL(document.url).pathname).replace('.', '').toLowerCase()

  if (urlExtension && urlExtension !== 'ashx') {
    return urlExtension
  }

  if (/pdf/i.test(mimeType ?? '')) {
    return 'pdf'
  }

  if (/spreadsheetml|xlsx/i.test(mimeType ?? '')) {
    return 'xlsx'
  }

  if (/excel|xls/i.test(mimeType ?? '')) {
    return 'xls'
  }

  if (/csv/i.test(mimeType ?? '')) {
    return 'csv'
  }

  return document.format === 'file_fetch' ? 'bin' : (document.format ?? 'bin')
}

function extractDocumentLinks(html: string, baseUrl: string) {
  const links: TjspPrecatorioDocumentLink[] = []
  const anchorPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = anchorPattern.exec(html))) {
    const href = decodeHtml(match[1]).trim()
    if (!isPrecatorioDocumentHref(href)) {
      continue
    }

    const url = new URL(href, baseUrl)
    const title = compactText(stripTags(match[2])) || url.pathname.split('/').at(-1) || 'Document'

    links.push({
      title,
      url: url.toString(),
      format: inferFormat(url),
      externalCode: url.searchParams.get('codigo'),
    })
  }

  return dedupeDocumentLinks(links)
}

function extractDetailTitle(html: string) {
  const heading =
    firstMatch(html, /<div\s+class=["']comunicado["'][^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/i) ??
    firstMatch(html, /<h3[^>]*>\s*<strong[^>]*>([\s\S]*?)<\/strong>\s*<\/h3>/i)

  return heading ? compactText(stripTags(heading)) || null : null
}

function extractFirstParagraph(html: string) {
  const paragraph = firstMatch(html, /<p[^>]*>([\s\S]*?)<\/p>/i)
  return paragraph ? compactText(stripTags(paragraph)) || null : null
}

function extractCommunicationBody(html: string) {
  return firstMatch(html, /<div\s+class=["']comunicado["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)
}

function isPrecatorioDocumentHref(href: string) {
  return (
    /FileFetch\.ashx/i.test(href) ||
    /\/Download\//i.test(href) ||
    /\.(?:csv|xls|xlsx|ods|pdf|html?)(?:$|\?)/i.test(href)
  )
}

function inferFormat(url: URL) {
  const pathname = url.pathname.toLowerCase()

  if (/filefetch\.ashx/i.test(pathname)) {
    return 'file_fetch'
  }

  const extension = pathname.match(/\.([a-z0-9]+)$/i)?.[1]
  if (extension) {
    return extension
  }

  return null
}

function categoryUrl(category: TjspPrecatorioCommunicationCategory) {
  const url = new URL(TJSP_PRECATORIO_COMMUNICATIONS_URL)
  url.searchParams.set('tipoDestino', CATEGORY_DESTINATION_CODES[category])
  return url.toString()
}

function defaultCategories(): TjspPrecatorioCommunicationCategory[] {
  return ['state_entities', 'municipal_entities', 'inss', 'statistics']
}

function dedupeCommunicationLinks(links: TjspPrecatorioCommunicationLink[]) {
  const seen = new Set<string>()

  return links.filter((link) => {
    const key = `${link.category}:${link.url}`
    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function dedupeDocumentLinks(links: TjspPrecatorioDocumentLink[]) {
  const seen = new Set<string>()

  return links.filter((link) => {
    if (seen.has(link.url)) {
      return false
    }

    seen.add(link.url)
    return true
  })
}

function firstMatch(input: string, pattern: RegExp) {
  return pattern.exec(input)?.[1] ?? null
}

function compactText(input: string) {
  return decodeHtml(input).replace(/\s+/g, ' ').trim()
}

function stripTags(input: string) {
  return input.replace(/<[^>]*>/g, '')
}

function decodeHtml(input: string) {
  return input
    .replace(/&#(\d+);/g, (_, codePoint: string) => String.fromCodePoint(Number(codePoint)))
    .replace(/&#x([a-f0-9]+);/gi, (_, codePoint: string) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16))
    )
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function parseBrazilianDate(value: string | null) {
  if (!value) {
    return null
  }

  const date = DateTime.fromFormat(compactText(value), 'dd/MM/yyyy')
  return date.isValid ? date.toISODate() : null
}

function numberOrNull(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export default new TjspPrecatorioCommunicationsAdapter()
