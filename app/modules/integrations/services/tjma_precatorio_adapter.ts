import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import sourceEvidenceService from '#modules/integrations/services/source_evidence_service'
import SourceRecord from '#modules/siop/models/source_record'
import type { JsonRecord } from '#shared/types/model_enums'

export const TJMA_PRECATORIO_LISTS_URL =
  'https://www.tjma.jus.br/hotsite/prec/item/6847/0/listas-cronologicas'

const TJMA_CATEGORY_ITEMS = new Set(['6848', '6849', '6850'])

export type TjmaPrecatorioLinkKind =
  | 'chronological_list'
  | 'paid_or_payment_process'
  | 'direct_agreement'
  | 'preferential_lot'
  | 'change_notice'
  | 'other_precatorio_report'

export type TjmaPrecatorioDebtorGroup = 'state' | 'sao_luis' | 'other_debtors'

export type TjmaPrecatorioLink = {
  kind: TjmaPrecatorioLinkKind
  title: string
  url: string
  year: number | null
  debtorGroup: TjmaPrecatorioDebtorGroup
  sourcePageUrl: string
  pathId: string
}

export type TjmaPrecatorioSyncOptions = {
  tenantId: string
  years?: number[] | null
  kinds?: TjmaPrecatorioLinkKind[] | null
  debtorGroups?: TjmaPrecatorioDebtorGroup[] | null
  limit?: number | null
  fetcher?: typeof fetch
  download?: boolean
}

export type TjmaPrecatorioSyncItem = {
  link: TjmaPrecatorioLink
  sourceRecord?: SourceRecord
  sourceRecordCreated?: boolean
}

export type TjmaPrecatorioSyncResult = {
  discovered: number
  selected: number
  downloaded: number
  sourceRecordsCreated: number
  items: TjmaPrecatorioSyncItem[]
}

class TjmaPrecatorioAdapter {
  async discover(fetcher: typeof fetch = fetch) {
    const landingPage = await fetchText(fetcher, TJMA_PRECATORIO_LISTS_URL)
    const categoryLinks = parseTjmaCategoryLinks(landingPage, TJMA_PRECATORIO_LISTS_URL)
    const links: TjmaPrecatorioLink[] = []

    for (const categoryLink of categoryLinks) {
      const categoryHtml = await fetchText(fetcher, categoryLink.url)
      links.push(
        ...parseTjmaPrecatorioLinks(categoryHtml, categoryLink.url, categoryLink.debtorGroup)
      )
    }

    return dedupeLinks(links).sort((left, right) => rankLink(right) - rankLink(left))
  }

  async sync(options: TjmaPrecatorioSyncOptions): Promise<TjmaPrecatorioSyncResult> {
    const fetcher = options.fetcher ?? fetch
    const discovered = await this.discover(fetcher)
    const selected = selectLinks(discovered, options)
    const result: TjmaPrecatorioSyncResult = {
      discovered: discovered.length,
      selected: selected.length,
      downloaded: 0,
      sourceRecordsCreated: 0,
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
      result.sourceRecordsCreated += persisted.created ? 1 : 0
    }

    return result
  }

  private async persistLink(tenantId: string, link: TjmaPrecatorioLink, fetcher: typeof fetch) {
    const response = await fetcher(link.url)
    if (!response.ok) {
      throw new Error(`TJMA precatorio document download failed with HTTP ${response.status}.`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentChecksum = createHash('sha256').update(buffer).digest('hex')
    const checksum = createHash('sha256').update(link.url).update(contentChecksum).digest('hex')
    const filename = buildStoredFilename(link, checksum)
    const directory = app.makePath('storage', 'tribunal', 'tjma', tenantId)
    const filePath = app.makePath('storage', 'tribunal', 'tjma', tenantId, filename)
    const rawData = buildRawData(link, contentChecksum)

    await mkdir(directory, { recursive: true })
    await writeFile(filePath, buffer)

    const sourceDatasetId = await sourceEvidenceService.datasetIdByKey('court-annual-map-pages')
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
        rawData,
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
      rawData,
    })

    return { sourceRecord, created: true }
  }
}

export function parseTjmaCategoryLinks(html: string, baseUrl: string) {
  const links: Array<{
    title: string
    url: string
    debtorGroup: TjmaPrecatorioDebtorGroup
  }> = []
  const anchorPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = anchorPattern.exec(html))) {
    const href = decodeHtml(match[1]).trim()
    const itemId = href.match(/\/hotsite\/prec\/item\/(\d+)/)?.[1]
    if (!itemId || !TJMA_CATEGORY_ITEMS.has(itemId)) {
      continue
    }

    const title = normalizeSpaces(decodeHtml(stripTags(match[2])))
    const url = new URL(href, baseUrl).toString()
    links.push({
      title,
      url,
      debtorGroup: debtorGroupForCategoryItem(itemId),
    })
  }

  return dedupeCategoryLinks(links)
}

export function parseTjmaPrecatorioLinks(
  html: string,
  sourcePageUrl: string,
  debtorGroup: TjmaPrecatorioDebtorGroup
) {
  const links: TjmaPrecatorioLink[] = []
  const anchorPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = anchorPattern.exec(html))) {
    const href = decodeHtml(match[1]).trim()
    if (!isDocumentUrl(href)) {
      continue
    }

    const url = new URL(href, sourcePageUrl).toString()
    const title = normalizeSpaces(decodeHtml(stripTags(match[2]))) || titleFromUrl(url)
    const haystack = normalizeKey(`${title} ${url}`)

    if (!haystack.includes('PRECATORIO') && !haystack.includes('ORDEM_CRONOLOGICA')) {
      continue
    }

    links.push({
      kind: classifyLink(haystack),
      title,
      url,
      year: inferYear(`${title} ${url}`),
      debtorGroup,
      sourcePageUrl,
      pathId: pathIdForUrl(url),
    })
  }

  return dedupeLinks(links)
}

function selectLinks(links: TjmaPrecatorioLink[], options: TjmaPrecatorioSyncOptions) {
  let selected = links

  if (options.years?.length) {
    const years = new Set(options.years)
    selected = selected.filter((link) => link.year !== null && years.has(link.year))
  }

  if (options.kinds?.length) {
    const kinds = new Set(options.kinds)
    selected = selected.filter((link) => kinds.has(link.kind))
  }

  if (options.debtorGroups?.length) {
    const groups = new Set(options.debtorGroups)
    selected = selected.filter((link) => groups.has(link.debtorGroup))
  }

  if (options.limit && options.limit > 0) {
    selected = selected.slice(0, Math.trunc(options.limit))
  }

  return selected
}

async function fetchText(fetcher: typeof fetch, url: string) {
  const response = await fetcher(url)
  if (!response.ok) {
    throw new Error(`TJMA precatorio discovery failed for ${url} with HTTP ${response.status}.`)
  }

  return decodeText(Buffer.from(await response.arrayBuffer()), response.headers.get('content-type'))
}

function debtorGroupForCategoryItem(itemId: string): TjmaPrecatorioDebtorGroup {
  if (itemId === '6848') return 'state'
  if (itemId === '6849') return 'sao_luis'
  return 'other_debtors'
}

function classifyLink(haystack: string): TjmaPrecatorioLinkKind {
  if (haystack.includes('ACORDO_DIRETO')) return 'direct_agreement'
  if (haystack.includes('PREFERENCIAL')) return 'preferential_lot'
  if (haystack.includes('ALTERACOES')) return 'change_notice'
  if (haystack.includes('PAGO') || haystack.includes('PAGAMENTO')) return 'paid_or_payment_process'
  if (
    haystack.includes('LISTA_UNIFICADA') ||
    haystack.includes('ORDEM_CRONOLOGICA') ||
    haystack.includes('LISTA_CRONOLOGICA') ||
    haystack.includes('ATUALIZADA')
  ) {
    return 'chronological_list'
  }

  return 'other_precatorio_report'
}

function buildRawData(link: TjmaPrecatorioLink, contentChecksum: string): JsonRecord {
  return {
    providerId: 'tjma-precatorio-reports',
    targetKey: 'court-map:tjma',
    courtAlias: 'tjma',
    stateCode: 'MA',
    sourceKind: link.kind,
    debtorGroup: link.debtorGroup,
    title: link.title,
    year: link.year,
    sourcePageUrl: link.sourcePageUrl,
    sourceUrl: link.url,
    contentChecksum,
  }
}

function buildStoredFilename(link: TjmaPrecatorioLink, checksum: string) {
  return `${slugify(
    `tjma-${link.debtorGroup}-${link.kind}-${link.year ?? 'unknown'}-${link.title}`
  ).slice(0, 96)}-${checksum.slice(0, 12)}.pdf`
}

function rankLink(link: TjmaPrecatorioLink) {
  const kindRank: Record<TjmaPrecatorioLinkKind, number> = {
    chronological_list: 100,
    paid_or_payment_process: 80,
    direct_agreement: 70,
    preferential_lot: 60,
    change_notice: 50,
    other_precatorio_report: 10,
  }

  return (link.year ?? 0) * 10 + kindRank[link.kind]
}

function isDocumentUrl(url: string) {
  return /\.pdf(?:$|[?#])/i.test(url)
}

function inferYear(value: string) {
  const years = [...value.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]))
  if (!years.length) {
    return null
  }

  return Math.max(...years)
}

function pathIdForUrl(url: string) {
  const pathname = new URL(url).pathname
  const filename = pathname.split('/').filter(Boolean).at(-1)
  return filename ?? createHash('sha1').update(url).digest('hex').slice(0, 12)
}

function titleFromUrl(url: string) {
  return decodeURIComponent(pathIdForUrl(url))
    .replace(/[_-]+/g, ' ')
    .replace(/\.pdf$/i, '')
    .trim()
}

function dedupeCategoryLinks<T extends { url: string }>(links: T[]) {
  const seen = new Set<string>()
  const unique: T[] = []

  for (const link of links) {
    if (seen.has(link.url)) {
      continue
    }

    seen.add(link.url)
    unique.push(link)
  }

  return unique
}

function dedupeLinks(links: TjmaPrecatorioLink[]) {
  const seen = new Set<string>()
  const unique: TjmaPrecatorioLink[] = []

  for (const link of links) {
    if (seen.has(link.url)) {
      continue
    }

    seen.add(link.url)
    unique.push(link)
  }

  return unique
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

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, ' ')
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&aacute;/gi, 'á')
    .replace(/&agrave;/gi, 'à')
    .replace(/&acirc;/gi, 'â')
    .replace(/&atilde;/gi, 'ã')
    .replace(/&eacute;/gi, 'é')
    .replace(/&ecirc;/gi, 'ê')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&ocirc;/gi, 'ô')
    .replace(/&otilde;/gi, 'õ')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ccedil;/gi, 'ç')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Atilde;/g, 'Ã')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&Ccedil;/g, 'Ç')
}

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function slugify(value: string) {
  return normalizeKey(value)
    .toLowerCase()
    .replace(/_+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default new TjmaPrecatorioAdapter()
