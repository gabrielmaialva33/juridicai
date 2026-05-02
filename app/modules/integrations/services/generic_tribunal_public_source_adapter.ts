import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import SourceRecord from '#modules/siop/models/source_record'
import sourceEvidenceService from '#modules/integrations/services/source_evidence_service'
import type { JsonRecord } from '#shared/types/model_enums'

export type GenericTribunalPublicSourceTarget = {
  key: string
  sourceDatasetKey: string
  name: string
  sourceUrl: string
  courtAlias: string | null
  stateCode: string | null
  metadata: JsonRecord | null
}

export type GenericTribunalPublicSourceLink = {
  title: string
  url: string
  format: string
  sourceKind: 'landing_page' | 'linked_document'
}

export type GenericTribunalPublicSourceSyncOptions = {
  tenantId: string
  target: GenericTribunalPublicSourceTarget
  fetcher?: typeof fetch
  downloadLinkedDocuments?: boolean
  limit?: number | null
}

export type GenericTribunalPublicSourceSyncResult = {
  discovered: number
  selected: number
  persisted: number
  sourceRecordsCreated: number
  items: Array<{
    link: GenericTribunalPublicSourceLink
    sourceRecordId: string
    created: boolean
  }>
}

class GenericTribunalPublicSourceAdapter {
  async sync(
    options: GenericTribunalPublicSourceSyncOptions
  ): Promise<GenericTribunalPublicSourceSyncResult> {
    const fetcher = options.fetcher ?? fetch
    const landingPage = await this.fetchLink(fetcher, {
      title: options.target.name,
      url: options.target.sourceUrl,
      format: 'html',
      sourceKind: 'landing_page',
    })
    const discovered =
      options.downloadLinkedDocuments === false
        ? []
        : parsePublicSourceLinks(landingPage.text, options.target.sourceUrl)
    const selected = limitLinks(discovered, options.limit)
    const links = [
      {
        title: options.target.name,
        url: options.target.sourceUrl,
        format: formatFromContentType(landingPage.contentType) ?? 'html',
        sourceKind: 'landing_page' as const,
      },
      ...selected,
    ]
    const result: GenericTribunalPublicSourceSyncResult = {
      discovered: discovered.length,
      selected: selected.length,
      persisted: 0,
      sourceRecordsCreated: 0,
      items: [],
    }

    for (const link of links) {
      const fetched =
        link.sourceKind === 'landing_page' ? landingPage : await this.fetchLink(fetcher, link)
      const persisted = await this.persistFetchedSource({
        tenantId: options.tenantId,
        target: options.target,
        link,
        buffer: fetched.buffer,
        contentType: fetched.contentType,
      })

      result.persisted += 1
      result.sourceRecordsCreated += persisted.created ? 1 : 0
      result.items.push({
        link,
        sourceRecordId: persisted.sourceRecord.id,
        created: persisted.created,
      })
    }

    return result
  }

  private async fetchLink(fetcher: typeof fetch, link: GenericTribunalPublicSourceLink) {
    const response = await fetcher(link.url)
    if (!response.ok) {
      throw new Error(
        `Generic tribunal public source fetch failed for ${link.url} with HTTP ${response.status}.`
      )
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type')

    return {
      buffer,
      contentType,
      text: decodeText(buffer, contentType),
    }
  }

  private async persistFetchedSource(input: {
    tenantId: string
    target: GenericTribunalPublicSourceTarget
    link: GenericTribunalPublicSourceLink
    buffer: Buffer
    contentType: string | null
  }) {
    const contentChecksum = createHash('sha256').update(input.buffer).digest('hex')
    const checksum = createHash('sha256')
      .update(input.link.url)
      .update(contentChecksum)
      .digest('hex')
    const sourceDatasetId = await sourceEvidenceService.datasetIdByKey(
      input.target.sourceDatasetKey
    )
    const filename = buildStoredFilename(input.target, input.link, checksum)
    const directory = app.makePath(
      'storage',
      'tribunal',
      input.target.courtAlias ?? 'generic',
      input.tenantId
    )
    const filePath = app.makePath(
      'storage',
      'tribunal',
      input.target.courtAlias ?? 'generic',
      input.tenantId,
      filename
    )
    const rawData = buildRawData(input.target, input.link, contentChecksum)
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
        sourceUrl: input.link.url,
        sourceFilePath: filePath,
        originalFilename: filename,
        mimeType: input.contentType ?? mimeTypeFor(input.link.format),
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
      sourceUrl: input.link.url,
      sourceFilePath: filePath,
      sourceChecksum: checksum,
      originalFilename: filename,
      mimeType: input.contentType ?? mimeTypeFor(input.link.format),
      fileSizeBytes: input.buffer.byteLength,
      collectedAt: DateTime.now(),
      rawData,
    })

    return { sourceRecord, created: true }
  }
}

export function parsePublicSourceLinks(
  html: string,
  baseUrl: string
): GenericTribunalPublicSourceLink[] {
  const links: GenericTribunalPublicSourceLink[] = []
  const anchorPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = anchorPattern.exec(html))) {
    const href = decodeHtml(match[1]).trim()
    const title = normalizeSpaces(decodeHtml(stripTags(match[2])))
    const absoluteUrl = safeUrl(href, baseUrl)

    if (
      !absoluteUrl ||
      isNoisePublicNavigationLink(title, absoluteUrl, baseUrl) ||
      !isRelevantPublicSourceLink(title, absoluteUrl)
    ) {
      continue
    }

    links.push({
      title: title || absoluteUrl,
      url: absoluteUrl,
      format: inferFormat(title, absoluteUrl),
      sourceKind: 'linked_document',
    })
  }

  return dedupeLinks(links).sort(
    (left, right) => rankPublicSourceLink(right) - rankPublicSourceLink(left)
  )
}

function isRelevantPublicSourceLink(title: string, url: string) {
  const haystack = normalizeText(`${title} ${url}`)
  const hasRelevantKeyword = [
    'precatorio',
    'precatorios',
    'rpv',
    'ordem cronologica',
    'mapa anual',
    'ente devedor',
    'acordo direto',
    'regime especial',
    'lista',
  ].some((keyword) => haystack.includes(keyword))

  return hasRelevantKeyword || hasImportableFormat(url)
}

function isNoisePublicNavigationLink(title: string, url: string, baseUrl: string) {
  const normalizedTitle = normalizeText(title)

  if (sameUrlIgnoringHash(url, baseUrl)) {
    return true
  }

  if (hasImportableFormat(url)) {
    return false
  }

  return [
    '',
    'home',
    'inicio',
    'pagina inicial',
    'legislacao',
    'perguntas frequentes',
    'faq',
    'contato',
    'noticias',
    'pular para o conteudo principal',
    'ir para o conteudo principal',
    'pular para conteudo',
  ].includes(normalizedTitle)
}

function rankPublicSourceLink(link: GenericTribunalPublicSourceLink) {
  const haystack = normalizeText(`${link.title} ${link.url}`)
  let score = 0

  if (hasImportableFormat(link.url)) score += 100
  if (haystack.includes('mapa anual')) score += 50
  if (haystack.includes('lista cronologica')) score += 50
  if (haystack.includes('ordem cronologica')) score += 50
  if (haystack.includes('ente devedor')) score += 45
  if (haystack.includes('acordo direto')) score += 40
  if (haystack.includes('regime especial')) score += 35
  if (haystack.includes('transparencia ativa')) score += 25
  if (haystack.includes('precatorio') || haystack.includes('precatorios')) score += 10
  if (haystack.includes('rpv')) score += 8

  return score
}

function sameUrlIgnoringHash(url: string, baseUrl: string) {
  try {
    const current = new URL(url)
    const base = new URL(baseUrl)
    current.hash = ''
    base.hash = ''

    return current.toString() === base.toString()
  } catch {
    return false
  }
}

function hasImportableFormat(url: string) {
  return /\.(csv|xls|xlsx|pdf)(?:$|[?#])/i.test(url)
}

function inferFormat(title: string, url: string) {
  const value = `${title} ${url}`.toLowerCase()

  if (/\.csv(?:$|[?#])|\bcsv\b/.test(value)) return 'csv'
  if (/\.xlsx(?:$|[?#])|\bxlsx\b/.test(value)) return 'xlsx'
  if (/\.xls(?:$|[?#])|\bxls\b/.test(value)) return 'xls'
  if (/\.pdf(?:$|[?#])|\bpdf\b/.test(value)) return 'pdf'
  return 'html'
}

function limitLinks(links: GenericTribunalPublicSourceLink[], limit?: number | null) {
  if (!limit || limit < 1) {
    return links
  }

  return links.slice(0, Math.trunc(limit))
}

function dedupeLinks(links: GenericTribunalPublicSourceLink[]) {
  const seen = new Set<string>()
  const unique: GenericTribunalPublicSourceLink[] = []

  for (const link of links) {
    if (seen.has(link.url)) {
      continue
    }

    seen.add(link.url)
    unique.push(link)
  }

  return unique
}

function buildRawData(
  target: GenericTribunalPublicSourceTarget,
  link: GenericTribunalPublicSourceLink,
  contentChecksum: string
): JsonRecord {
  return {
    providerId: 'generic-tribunal-public-source',
    targetKey: target.key,
    courtAlias: target.courtAlias,
    stateCode: target.stateCode,
    sourceKind: link.sourceKind,
    title: link.title,
    format: link.format,
    sourceUrl: link.url,
    contentChecksum,
    targetMetadata: target.metadata ?? {},
  }
}

function buildStoredFilename(
  target: GenericTribunalPublicSourceTarget,
  link: GenericTribunalPublicSourceLink,
  checksum: string
) {
  const slug = slugify(`${target.courtAlias ?? 'tribunal'}-${link.sourceKind}-${link.title}`)
  return `${slug.slice(0, 96)}-${checksum.slice(0, 12)}.${extensionFor(link.format)}`
}

function safeUrl(href: string, baseUrl: string) {
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return null
  }
}

function decodeText(buffer: Buffer, contentType: string | null) {
  const charset = contentType?.match(/charset=([^;]+)/i)?.[1]?.toLowerCase()

  if (charset?.includes('iso-8859-1') || charset?.includes('windows-1252')) {
    return new TextDecoder('windows-1252').decode(buffer)
  }

  const utf8 = buffer.toString('utf8')
  if (!utf8.includes('\uFFFD')) {
    return utf8
  }

  return new TextDecoder('windows-1252').decode(buffer)
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, ' ')
}

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function slugify(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function extensionFor(format: string) {
  if (['csv', 'xls', 'xlsx', 'pdf'].includes(format)) {
    return format
  }

  return 'html'
}

function mimeTypeFor(format: string) {
  if (format === 'csv') return 'text/csv'
  if (format === 'xls') return 'application/vnd.ms-excel'
  if (format === 'xlsx') {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }
  if (format === 'pdf') return 'application/pdf'
  return 'text/html'
}

function formatFromContentType(contentType: string | null) {
  if (!contentType) {
    return null
  }

  if (contentType.includes('csv')) return 'csv'
  if (contentType.includes('spreadsheetml')) return 'xlsx'
  if (contentType.includes('excel')) return 'xls'
  if (contentType.includes('pdf')) return 'pdf'
  if (contentType.includes('html')) return 'html'
  return null
}

export default new GenericTribunalPublicSourceAdapter()
