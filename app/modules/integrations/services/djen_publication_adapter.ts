import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import Publication from '#modules/precatorios/models/publication'
import SourceRecord from '#modules/siop/models/source_record'
import referenceCatalogService from '#modules/reference/services/reference_catalog_service'
import sourceEvidenceService from '#modules/integrations/services/source_evidence_service'
import publicationSignalClassifierService from '#modules/integrations/services/publication_signal_classifier_service'
import { normalizeCnj } from '#modules/siop/parsers/cnj_parser'
import type { JsonRecord } from '#shared/types/model_enums'

export const DJEN_PUBLIC_COMMUNICATIONS_URL = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao'

export type DjenCommunicationQuery = {
  numeroProcesso?: string | null
  siglaTribunal?: string | null
  texto?: string | null
  nomeParte?: string | null
  nomeAdvogado?: string | null
  numeroOab?: string | null
  ufOab?: string | null
  dataDisponibilizacaoInicio?: string | null
  dataDisponibilizacaoFim?: string | null
  meio?: 'D' | 'E' | null
  pagina?: number | null
  itensPorPagina?: 5 | 100 | null
}

export type DjenPublicationSyncOptions = DjenCommunicationQuery & {
  tenantId: string
  maxPages?: number | null
  fetcher?: typeof fetch
  classifySignals?: boolean
}

export type DjenPublicationSyncResult = {
  requestedPages: number
  count: number
  fetched: number
  sourceRecordsCreated: number
  sourceRecordsReused: number
  processesCreated: number
  processesUpdated: number
  publicationsCreated: number
  publicationsUpdated: number
  linkedAssets: number
  publicationSignals: {
    matchedSignals: number
    publicationEventsUpserted: number
    assetEventsUpserted: number
    assetScoresRefreshed: number
  }
  rateLimit: {
    limit: number | null
    remaining: number | null
  }
}

type DjenCommunicationResponse = {
  status?: string
  message?: string
  count?: number
  items?: DjenCommunicationItem[]
}

type DjenCommunicationItem = {
  id?: number
  data_disponibilizacao?: string
  siglaTribunal?: string
  tipoComunicacao?: string
  nomeOrgao?: string
  idOrgao?: number
  texto?: string
  numero_processo?: string
  meio?: string
  link?: string | null
  tipoDocumento?: string
  nomeClasse?: string
  codigoClasse?: string
  numeroComunicacao?: number
  ativo?: boolean
  hash?: string
  datadisponibilizacao?: string
  meiocompleto?: string
  numeroprocessocommascara?: string
  destinatarios?: unknown[]
  destinatarioadvogados?: unknown[]
  [key: string]: unknown
}

class DjenPublicationAdapter {
  async search(options: DjenCommunicationQuery & { fetcher?: typeof fetch } = {}) {
    const fetcher = options.fetcher ?? fetch
    const endpoint = buildCommunicationUrl(options)
    const response = await fetcher(endpoint)

    if (response.status === 429) {
      throw new Error('DJEN public API rate limit exceeded. Retry after at least one minute.')
    }

    if (!response.ok) {
      throw new Error(`DJEN public API search failed with HTTP ${response.status}.`)
    }

    const body = (await response.json()) as DjenCommunicationResponse
    return {
      endpoint,
      body,
      rateLimit: {
        limit: numberOrNull(response.headers.get('x-ratelimit-limit')),
        remaining: numberOrNull(response.headers.get('x-ratelimit-remaining')),
      },
    }
  }

  async sync(options: DjenPublicationSyncOptions): Promise<DjenPublicationSyncResult> {
    const maxPages = normalizeMaxPages(options.maxPages)
    const firstPage = normalizePage(options.pagina)
    const metrics = emptyMetrics()

    for (let pageOffset = 0; pageOffset < maxPages; pageOffset += 1) {
      const page = firstPage + pageOffset
      const result = await this.search({
        ...options,
        pagina: page,
      })
      const items = result.body.items ?? []

      metrics.requestedPages += 1
      metrics.count = Math.max(metrics.count, Number(result.body.count ?? items.length))
      metrics.fetched += items.length
      metrics.rateLimit = result.rateLimit

      for (const item of items) {
        const persisted = await this.persistCommunication(options.tenantId, result.endpoint, item)
        if (persisted.sourceRecordCreated) {
          metrics.sourceRecordsCreated += 1
        } else {
          metrics.sourceRecordsReused += 1
        }
        if (persisted.processCreated === true) {
          metrics.processesCreated += 1
        } else if (persisted.processCreated === false) {
          metrics.processesUpdated += 1
        }
        if (persisted.publicationCreated) {
          metrics.publicationsCreated += 1
        } else {
          metrics.publicationsUpdated += 1
        }
        if (persisted.linkedAsset) {
          metrics.linkedAssets += 1
        }

        if (options.classifySignals !== false) {
          const signalMetrics = await publicationSignalClassifierService.classify({
            tenantId: options.tenantId,
            publicationId: persisted.publication.id,
            projectAssetEvents: true,
          })
          metrics.publicationSignals.matchedSignals += signalMetrics.matchedSignals
          metrics.publicationSignals.publicationEventsUpserted +=
            signalMetrics.publicationEventsUpserted
          metrics.publicationSignals.assetEventsUpserted += signalMetrics.assetEventsUpserted
          metrics.publicationSignals.assetScoresRefreshed += signalMetrics.assetScoresRefreshed
        }
      }

      if (items.length < normalizeItemsPerPage(options.itensPorPagina)) {
        break
      }
    }

    return metrics
  }

  private async persistCommunication(
    tenantId: string,
    endpoint: string,
    item: DjenCommunicationItem
  ) {
    const sourceRecord = await this.upsertSourceRecord(tenantId, endpoint, item)
    const processResult = await this.upsertJudicialProcess(tenantId, sourceRecord, item)
    const publicationResult = await this.upsertPublication(
      tenantId,
      sourceRecord,
      item,
      processResult.judicialProcess,
      processResult.asset
    )

    if (processResult.asset) {
      await this.recordSourceEvidence(tenantId, sourceRecord, item, processResult.asset)
    }

    return {
      sourceRecordCreated: sourceRecord.$extras.created === true,
      processCreated: processResult.created,
      publication: publicationResult.publication,
      publicationCreated: publicationResult.created,
      linkedAsset: Boolean(processResult.asset),
    }
  }

  private async upsertSourceRecord(
    tenantId: string,
    endpoint: string,
    item: DjenCommunicationItem
  ) {
    const sourceDatasetId = await sourceEvidenceService.datasetIdByKey('djen-public-communications')
    const checksum = stableHash({
      providerId: 'djen-public-communications',
      id: item.id,
      hash: item.hash,
      numeroComunicacao: item.numeroComunicacao,
    })
    const rawData = {
      providerId: 'djen-public-communications',
      endpoint,
      item,
    }
    const existing = await SourceRecord.query()
      .where('tenant_id', tenantId)
      .where('source', 'djen')
      .where('source_checksum', checksum)
      .first()

    if (existing) {
      existing.merge({
        sourceDatasetId,
        sourceUrl: endpoint,
        collectedAt: DateTime.utc(),
        rawData,
      })
      await existing.save()
      existing.$extras.created = false
      return existing
    }

    const sourceRecord = await SourceRecord.create({
      tenantId,
      sourceDatasetId,
      source: 'djen',
      sourceUrl: endpoint,
      sourceChecksum: checksum,
      collectedAt: DateTime.utc(),
      rawData,
    })
    sourceRecord.$extras.created = true
    return sourceRecord
  }

  private async upsertJudicialProcess(
    tenantId: string,
    sourceRecord: SourceRecord,
    item: DjenCommunicationItem
  ) {
    const cnjNumber = normalizeCnj(
      String(item.numero_processo ?? item.numeroprocessocommascara ?? '')
    )
    if (!cnjNumber) {
      return {
        judicialProcess: null,
        asset: null,
        created: null,
      }
    }

    const asset = await PrecatorioAsset.query()
      .where('tenant_id', tenantId)
      .where('cnj_number', cnjNumber)
      .first()
    const courtCode = stringOrNull(item.siglaTribunal)
    const court = await referenceCatalogService.court({
      code: courtCode,
      alias: courtCode?.toLowerCase() ?? null,
      name: courtCode ?? null,
    })
    const judicialClass = await referenceCatalogService.judicialClass({
      code: numberOrNull(item.codigoClasse),
      name: stringOrNull(item.nomeClasse),
    })
    const existing = await JudicialProcess.query()
      .where('tenant_id', tenantId)
      .where('cnj_number', cnjNumber)
      .first()

    if (existing) {
      existing.merge({
        assetId: existing.assetId ?? asset?.id ?? null,
        sourceRecordId: existing.sourceRecordId ?? sourceRecord.id,
        courtId: existing.courtId ?? court?.id ?? null,
        classId: existing.classId ?? judicialClass?.id ?? null,
        courtAlias: existing.courtAlias ?? courtCode?.toLowerCase() ?? null,
        rawData: {
          ...(existing.rawData ?? {}),
          djen: buildProcessRawData(item),
        },
      })
      await existing.save()

      return {
        judicialProcess: existing,
        asset,
        created: false,
      }
    }

    const judicialProcess = await JudicialProcess.create({
      tenantId,
      assetId: asset?.id ?? null,
      sourceRecordId: sourceRecord.id,
      source: 'djen',
      cnjNumber,
      courtId: court?.id ?? null,
      classId: judicialClass?.id ?? null,
      courtAlias: courtCode?.toLowerCase() ?? null,
      rawData: buildProcessRawData(item),
    })

    return {
      judicialProcess,
      asset,
      created: true,
    }
  }

  private async upsertPublication(
    tenantId: string,
    sourceRecord: SourceRecord,
    item: DjenCommunicationItem,
    judicialProcess: JudicialProcess | null,
    asset: PrecatorioAsset | null
  ) {
    const publicationDate = parsePublicationDate(item) ?? DateTime.utc()
    const textHash = stableHash({
      providerId: 'djen-public-communications',
      id: item.id,
      hash: item.hash,
      text: item.texto,
    })
    const existing = await Publication.query()
      .where('tenant_id', tenantId)
      .where('source', 'djen')
      .where('text_hash', textHash)
      .where('publication_date', publicationDate.toFormat('yyyy-LL-dd'))
      .first()
    const payload = {
      tenantId,
      assetId: asset?.id ?? judicialProcess?.assetId ?? null,
      processId: judicialProcess?.id ?? null,
      sourceRecordId: sourceRecord.id,
      source: 'djen' as const,
      publicationDate,
      title: publicationTitle(item),
      body: String(item.texto ?? ''),
      textHash,
      rawData: item as JsonRecord,
    }

    if (existing) {
      existing.merge(payload)
      await existing.save()
      return {
        publication: existing,
        created: false,
      }
    }

    return {
      publication: await Publication.create(payload),
      created: true,
    }
  }

  private async recordSourceEvidence(
    tenantId: string,
    sourceRecord: SourceRecord,
    item: DjenCommunicationItem,
    asset: PrecatorioAsset
  ) {
    const cnjNumber = normalizeCnj(
      String(item.numero_processo ?? item.numeroprocessocommascara ?? '')
    )

    await sourceEvidenceService.linkAsset({
      tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: 'djen-public-communications',
      linkType: 'enrichment',
      confidence: cnjNumber ? 1 : 0.75,
      matchReason: cnjNumber ? 'djen_cnj_match' : 'djen_publication_asset_link',
      matchedFields: {
        cnjNumber,
        communicationId: item.id,
        communicationHash: item.hash,
      },
      normalizedPayload: {
        cnjNumber,
        courtAlias: stringOrNull(item.siglaTribunal)?.toLowerCase() ?? null,
        publicationDate: parsePublicationDate(item)?.toISODate() ?? null,
        communicationType: stringOrNull(item.tipoComunicacao),
      },
      rawPointer: {
        sourceRecordId: sourceRecord.id,
        communicationId: item.id,
        hash: item.hash,
      },
    })

    await sourceEvidenceService.upsertIdentifier({
      tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: 'djen-public-communications',
      identifierType: 'cnj_number',
      identifierValue: cnjNumber,
      issuer: stringOrNull(item.siglaTribunal) ?? 'DJEN',
      isPrimary: true,
      rawData: item as JsonRecord,
    })
    await sourceEvidenceService.upsertIdentifier({
      tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: 'djen-public-communications',
      identifierType: 'source_external_id',
      identifierValue: item.hash ?? (item.id ? String(item.id) : null),
      issuer: 'DJEN',
      rawData: item as JsonRecord,
    })
  }
}

function buildCommunicationUrl(query: DjenCommunicationQuery) {
  const url = new URL(DJEN_PUBLIC_COMMUNICATIONS_URL)
  const params = new URLSearchParams()
  const normalized = {
    ...query,
    meio: query.meio ?? 'D',
    pagina: normalizePage(query.pagina),
    itensPorPagina: normalizeItemsPerPage(query.itensPorPagina),
  }

  for (const [key, value] of Object.entries(normalized)) {
    if (value !== null && value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  }

  url.search = params.toString()
  return url.toString()
}

function emptyMetrics(): DjenPublicationSyncResult {
  return {
    requestedPages: 0,
    count: 0,
    fetched: 0,
    sourceRecordsCreated: 0,
    sourceRecordsReused: 0,
    processesCreated: 0,
    processesUpdated: 0,
    publicationsCreated: 0,
    publicationsUpdated: 0,
    linkedAssets: 0,
    publicationSignals: {
      matchedSignals: 0,
      publicationEventsUpserted: 0,
      assetEventsUpserted: 0,
      assetScoresRefreshed: 0,
    },
    rateLimit: {
      limit: null,
      remaining: null,
    },
  }
}

function buildProcessRawData(item: DjenCommunicationItem): JsonRecord {
  return {
    providerId: 'djen-public-communications',
    communicationId: item.id ?? null,
    communicationHash: item.hash ?? null,
    courtAlias: item.siglaTribunal ?? null,
    classCode: item.codigoClasse ?? null,
    className: item.nomeClasse ?? null,
    organName: item.nomeOrgao ?? null,
  }
}

function publicationTitle(item: DjenCommunicationItem) {
  return [item.siglaTribunal, item.tipoComunicacao, item.nomeClasse].filter(Boolean).join(' · ')
}

function parsePublicationDate(item: DjenCommunicationItem) {
  if (item.data_disponibilizacao) {
    const value = DateTime.fromISO(item.data_disponibilizacao, { zone: 'utc' })
    if (value.isValid) {
      return value
    }
  }

  if (item.datadisponibilizacao) {
    const value = DateTime.fromFormat(item.datadisponibilizacao, 'dd/LL/yyyy', { zone: 'utc' })
    if (value.isValid) {
      return value
    }
  }

  return null
}

function normalizePage(value?: number | null) {
  if (!value || value < 1) {
    return 1
  }

  return Math.floor(value)
}

function normalizeItemsPerPage(value?: number | null) {
  return value === 5 ? 5 : 100
}

function normalizeMaxPages(value?: number | null) {
  if (!value || value < 1) {
    return 1
  }

  return Math.min(Math.floor(value), 100)
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function stringOrNull(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  const stringValue = String(value).trim()
  return stringValue.length ? stringValue : null
}

function stableHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export default new DjenPublicationAdapter()
