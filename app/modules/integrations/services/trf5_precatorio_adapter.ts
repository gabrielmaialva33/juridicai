import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import sourceEvidenceService from '#modules/integrations/services/source_evidence_service'
import SourceRecord from '#modules/siop/models/source_record'
import type { JsonRecord } from '#shared/types/model_enums'

export const TRF5_PRECATORIO_MAP_URL = 'https://rpvprecatorio.trf5.jus.br/mapa'

export type Trf5PrecatorioLinkKind =
  | 'annual_map'
  | 'consolidated_report'
  | 'indicators'
  | 'paid_precatorios'
  | 'federal_debt'
  | 'state_municipal_chronological_order'
  | 'state_municipal_special_regime_ec94'
  | 'state_municipal_special_regime_ec136'

export type Trf5PrecatorioLink = {
  kind: Trf5PrecatorioLinkKind
  title: string
  url: string
  year: number | null
  debtorName: string | null
  pathId: string
}

export type Trf5PrecatorioSyncOptions = {
  tenantId: string
  years?: number[] | null
  kinds?: Trf5PrecatorioLinkKind[] | null
  limit?: number | null
  fetcher?: typeof fetch
  download?: boolean
}

export type Trf5PrecatorioSyncItem = {
  link: Trf5PrecatorioLink
  sourceRecord?: SourceRecord
  sourceRecordCreated?: boolean
}

export type Trf5PrecatorioSyncResult = {
  discovered: number
  selected: number
  downloaded: number
  items: Trf5PrecatorioSyncItem[]
}

class Trf5PrecatorioAdapter {
  async discover(fetcher: typeof fetch = fetch) {
    const response = await fetcher(TRF5_PRECATORIO_MAP_URL)
    if (!response.ok) {
      throw new Error(`TRF5 precatorio discovery failed with HTTP ${response.status}.`)
    }

    return parseTrf5PrecatorioLinks(await response.text(), TRF5_PRECATORIO_MAP_URL)
  }

  async sync(options: Trf5PrecatorioSyncOptions): Promise<Trf5PrecatorioSyncResult> {
    const fetcher = options.fetcher ?? fetch
    const discovered = await this.discover(fetcher)
    const selected = selectLinks(discovered, options)
    const result: Trf5PrecatorioSyncResult = {
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

  private async persistLink(tenantId: string, link: Trf5PrecatorioLink, fetcher: typeof fetch) {
    const response = await fetcher(link.url)
    if (!response.ok) {
      throw new Error(`TRF5 precatorio PDF download failed with HTTP ${response.status}.`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentChecksum = createHash('sha256').update(buffer).digest('hex')
    const checksum = createHash('sha256').update(buffer).update(link.url).digest('hex')
    const filename = buildStoredFilename(link, checksum)
    const directory = app.makePath('storage', 'tribunal', 'trf5', tenantId)
    const filePath = app.makePath('storage', 'tribunal', 'trf5', tenantId, filename)
    const metadata = buildMetadata(link, contentChecksum)

    await mkdir(directory, { recursive: true })
    await writeFile(filePath, buffer)

    const sourceDatasetId = await sourceEvidenceService.datasetIdByKey('trf5-precatorio-reports')
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

export function parseTrf5PrecatorioLinks(html: string, baseUrl: string): Trf5PrecatorioLink[] {
  return dedupeLinks([
    ...parseMapLinks(html, baseUrl),
    ...parseFederalDebtLinks(html, baseUrl),
    ...parseStateMunicipalDebtLinks(html, baseUrl),
  ])
}

function parseMapLinks(html: string, baseUrl: string) {
  const links: Trf5PrecatorioLink[] = []
  const anchorPattern =
    /<a\s+[^>]*href=["']([^"']*\/downloadMapas\/(\d+))["'][^>]*title=["']([^"']+)["'][^>]*>\s*(\d{4})\s*<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = anchorPattern.exec(html))) {
    const title = decodeHtml(match[3]).replace(/\s+/g, ' ').trim()
    const kind = classifyMapTitle(title)

    if (!kind) {
      continue
    }

    links.push({
      kind,
      title,
      url: new URL(match[1], baseUrl).toString(),
      year: Number(match[4]),
      debtorName: null,
      pathId: match[2],
    })
  }

  return links
}

function parseFederalDebtLinks(html: string, baseUrl: string) {
  const section = sliceBetween(html, '<h3>Federais</h3>', '<h3>Estaduais e Municipais</h3>')
  return parsePanelOptionLinks(
    section,
    baseUrl,
    'federal_debt',
    'downloadDividaFederal',
    'TRF5 dívida federal'
  )
}

function parseStateMunicipalDebtLinks(html: string, baseUrl: string) {
  const section = sliceBetween(
    html,
    '<h3>Estaduais e Municipais</h3>',
    '<div class="row" id="footer">'
  )

  return [
    ...parsePanelOptionLinks(
      sliceHeadingSection(section, /<h4\b[^>]*>\s*Ordem Cronol[óo]gica[\s\S]*?<\/h4>/i),
      baseUrl,
      'state_municipal_chronological_order',
      'downloadDividaEstOrdem',
      'TRF5 ordem cronológica estadual/municipal'
    ),
    ...parsePanelOptionLinks(
      sliceHeadingSection(
        section,
        /<h4\b[^>]*>\s*Ente Devedor - Regime Especial \(EC94\/2016\)\s*<\/h4>/i
      ),
      baseUrl,
      'state_municipal_special_regime_ec94',
      'downloadDividaEstEntespc',
      'TRF5 regime especial EC94 estadual/municipal'
    ),
    ...parsePanelOptionLinks(
      sliceHeadingSection(
        section,
        /<h4\b[^>]*>\s*Ente Devedor - Regime Especial \(EC136\/2025\)\s*<\/h4>/i
      ),
      baseUrl,
      'state_municipal_special_regime_ec136',
      'downloadDividaEstEnte',
      'TRF5 regime especial EC136 estadual/municipal'
    ),
  ]
}

function parsePanelOptionLinks(
  section: string,
  baseUrl: string,
  kind: Trf5PrecatorioLinkKind,
  endpoint: string,
  titlePrefix: string
) {
  const links: Trf5PrecatorioLink[] = []
  const panelPattern =
    /<div class=["']panel-heading["']>\s*(\d{4})\s*<\/div>[\s\S]*?<select[\s\S]*?<\/select>/gi
  let panelMatch: RegExpExecArray | null

  while ((panelMatch = panelPattern.exec(section))) {
    const year = Number(panelMatch[1])
    const optionPattern = new RegExp(
      `<option\\s+value=["']([^"']*\\/${endpoint}\\/(\\d+))["'][^>]*>([\\s\\S]*?)<\\/option>`,
      'gi'
    )
    let optionMatch: RegExpExecArray | null

    while ((optionMatch = optionPattern.exec(panelMatch[0]))) {
      const debtorName = decodeHtml(stripTags(optionMatch[3])).replace(/\s+/g, ' ').trim()
      if (!debtorName || /selecione/i.test(debtorName)) {
        continue
      }

      links.push({
        kind,
        title: `${titlePrefix} ${year} - ${debtorName}`,
        url: new URL(optionMatch[1], baseUrl).toString(),
        year,
        debtorName,
        pathId: optionMatch[2],
      })
    }
  }

  return links
}

function classifyMapTitle(title: string): Trf5PrecatorioLinkKind | null {
  const normalized = title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()

  if (normalized.includes('LISTA PRECATORIOS') && normalized.includes('PAGOS')) {
    return 'paid_precatorios'
  }

  if (normalized.includes('DEMONSTRATIVO')) {
    return 'consolidated_report'
  }

  if (normalized.includes('INDICADORES')) {
    return 'indicators'
  }

  if (normalized.includes('MAPA ANUAL')) {
    return 'annual_map'
  }

  return null
}

function selectLinks(links: Trf5PrecatorioLink[], options: Trf5PrecatorioSyncOptions) {
  let selected = links

  if (options.kinds?.length) {
    const kinds = new Set(options.kinds)
    selected = selected.filter((link) => kinds.has(link.kind))
  }

  if (options.years?.length) {
    const years = new Set(options.years)
    selected = selected.filter((link) => link.year !== null && years.has(link.year))
  }

  if (options.limit && options.limit > 0) {
    selected = selected.slice(0, Math.trunc(options.limit))
  }

  return selected
}

function buildMetadata(link: Trf5PrecatorioLink, contentChecksum: string): JsonRecord {
  return {
    providerId: 'trf5-precatorio-reports',
    courtAlias: 'trf5',
    sourceKind: link.kind,
    title: link.title,
    year: link.year,
    debtorName: link.debtorName,
    pathId: link.pathId,
    sourceUrl: link.url,
    contentChecksum,
  }
}

function buildStoredFilename(link: Trf5PrecatorioLink, checksum: string) {
  const hash = checksum.slice(0, 12)
  const year = link.year ?? 'unknown-year'
  return `${link.kind}-${year}-${link.pathId}-${hash}.pdf`
}

function dedupeLinks(links: Trf5PrecatorioLink[]) {
  const seen = new Set<string>()

  return links.filter((link) => {
    if (seen.has(link.url)) {
      return false
    }

    seen.add(link.url)
    return true
  })
}

function sliceBetween(text: string, startMarker: string, endMarker: string) {
  const start = text.indexOf(startMarker)
  if (start === -1) {
    return ''
  }

  const end = text.indexOf(endMarker, start)
  return text.slice(start, end === -1 ? text.length : end)
}

function sliceHeadingSection(text: string, headingPattern: RegExp) {
  const match = headingPattern.exec(text)
  if (!match) {
    return ''
  }

  const start = match.index
  const tail = text.slice(start + match[0].length)
  const nextHeadingIndex = tail.search(/<h4\b/i)

  return text.slice(
    start,
    nextHeadingIndex === -1 ? text.length : start + match[0].length + nextHeadingIndex
  )
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

export default new Trf5PrecatorioAdapter()
