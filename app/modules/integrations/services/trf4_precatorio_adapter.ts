import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import SourceRecord from '#modules/siop/models/source_record'
import sourceEvidenceService from '#modules/integrations/services/source_evidence_service'
import { parseTrf2ChronologicalCsv } from '#modules/integrations/services/trf2_precatorio_adapter'
import type { JsonRecord } from '#shared/types/model_enums'

export const TRF4_CHRONOLOGICAL_QUEUE_URL =
  'https://www.trf4.jus.br/trf4/controlador.php?acao=consulta_precatorios_ordem_cronologica_externa'

export type Trf4PrecatorioQueueKind =
  | 'federal_budget'
  | 'extra_budget_general'
  | 'extra_budget_special'

export type Trf4PrecatorioLink = {
  kind: Trf4PrecatorioQueueKind
  formValue: 'O' | 'E' | 'EE'
  title: string
  url: string
  generatedFilename: string
  generatedAt: string
}

export type Trf4PrecatorioSyncOptions = {
  tenantId: string
  queueKinds?: Trf4PrecatorioQueueKind[] | null
  fetcher?: typeof fetch
  download?: boolean
}

export type Trf4PrecatorioSyncItem = {
  link: Trf4PrecatorioLink
  sourceRecord?: SourceRecord
  sourceRecordCreated?: boolean
  parsedRows?: number
  validCnjRows?: number
  uniqueCnjNumbers?: number
}

export type Trf4PrecatorioSyncResult = {
  discovered: number
  selected: number
  downloaded: number
  items: Trf4PrecatorioSyncItem[]
}

const QUEUES = [
  {
    kind: 'federal_budget',
    formValue: 'O',
    title: 'TRF4 ordem cronológica - Fazenda Pública Federal',
  },
  {
    kind: 'extra_budget_general',
    formValue: 'E',
    title: 'TRF4 ordem cronológica - Entidades extraorçamentárias regime geral',
  },
  {
    kind: 'extra_budget_special',
    formValue: 'EE',
    title: 'TRF4 ordem cronológica - Entidades extraorçamentárias regime especial',
  },
] as const

class Trf4PrecatorioAdapter {
  async discover(fetcher: typeof fetch = fetch) {
    const links: Trf4PrecatorioLink[] = []

    for (const queue of QUEUES) {
      const response = await fetcher(TRF4_CHRONOLOGICAL_QUEUE_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ rdoTipo: queue.formValue }),
      })

      if (!response.ok) {
        throw new Error(`TRF4 precatorio discovery failed with HTTP ${response.status}.`)
      }

      const html = await response.text()
      const generatedPath = extractGeneratedCsvPath(html)
      if (!generatedPath) {
        continue
      }

      const url = new URL(generatedPath, TRF4_CHRONOLOGICAL_QUEUE_URL).toString()
      links.push({
        ...queue,
        url,
        generatedFilename: extractGeneratedFilename(url),
        generatedAt: DateTime.utc().toISO()!,
      })
    }

    return links
  }

  async sync(options: Trf4PrecatorioSyncOptions): Promise<Trf4PrecatorioSyncResult> {
    const fetcher = options.fetcher ?? fetch
    const discovered = await this.discover(fetcher)
    const selected = selectLinks(discovered, options.queueKinds)
    const result: Trf4PrecatorioSyncResult = {
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
      const parsedRows = parseTrf2ChronologicalCsv(persisted.contents)

      item.sourceRecord = persisted.sourceRecord
      item.sourceRecordCreated = persisted.created
      item.parsedRows = parsedRows.length
      item.validCnjRows = parsedRows.filter((row) => row.cnjNumber).length
      item.uniqueCnjNumbers = new Set(parsedRows.map((row) => row.cnjNumber).filter(Boolean)).size
      result.downloaded += 1
    }

    return result
  }

  private async persistLink(tenantId: string, link: Trf4PrecatorioLink, fetcher: typeof fetch) {
    const response = await fetcher(link.url)
    if (!response.ok) {
      throw new Error(`TRF4 precatorio CSV download failed with HTTP ${response.status}.`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentChecksum = createHash('sha256').update(buffer).digest('hex')
    const checksum = createHash('sha256').update(buffer).update(link.url).digest('hex')
    const filename = buildStoredFilename(link, checksum)
    const directory = app.makePath('storage', 'tribunal', 'trf4', tenantId)
    const filePath = app.makePath('storage', 'tribunal', 'trf4', tenantId, filename)
    const metadata = buildMetadata(link, contentChecksum)

    await mkdir(directory, { recursive: true })
    await writeFile(filePath, buffer)

    const sourceDatasetId = await sourceEvidenceService.datasetIdByKey(
      'trf4-chronological-precatorios'
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
        mimeType: response.headers.get('content-type') ?? 'text/csv',
        fileSizeBytes: buffer.byteLength,
        rawData: metadata,
      })
      await existing.save()

      return { sourceRecord: existing, created: false, contents: buffer }
    }

    const sourceRecord = await SourceRecord.create({
      tenantId,
      sourceDatasetId,
      source: 'tribunal',
      sourceUrl: link.url,
      sourceFilePath: filePath,
      sourceChecksum: checksum,
      originalFilename: filename,
      mimeType: response.headers.get('content-type') ?? 'text/csv',
      fileSizeBytes: buffer.byteLength,
      collectedAt: DateTime.now(),
      rawData: metadata,
    })

    return { sourceRecord, created: true, contents: buffer }
  }
}

function extractGeneratedCsvPath(html: string) {
  const match = html.match(/salvar_como_txt\.php\?arq=[^'")<>\s]+/i)
  return match?.[0] ?? null
}

function extractGeneratedFilename(url: string) {
  return new URL(url).searchParams.get('arq')?.trim() || 'precatorios_ordem_cronologica.csv'
}

function selectLinks(links: Trf4PrecatorioLink[], queueKinds?: Trf4PrecatorioQueueKind[] | null) {
  if (!queueKinds?.length) {
    return links
  }

  const selected = new Set(queueKinds)
  return links.filter((link) => selected.has(link.kind))
}

function buildMetadata(link: Trf4PrecatorioLink, contentChecksum: string): JsonRecord {
  return {
    providerId: 'trf4-chronological-precatorios',
    courtAlias: 'trf4',
    sourceKind: link.kind,
    formValue: link.formValue,
    title: link.title,
    generatedFilename: link.generatedFilename,
    generatedAt: link.generatedAt,
    sourceUrl: link.url,
    contentChecksum,
  }
}

function buildStoredFilename(link: Trf4PrecatorioLink, checksum: string) {
  const hash = checksum.slice(0, 12)
  return `${link.kind}-${hash}-${safeGeneratedFilename(link)}`
}

function safeGeneratedFilename(link: Trf4PrecatorioLink) {
  return link.generatedFilename
}

export default new Trf4PrecatorioAdapter()
