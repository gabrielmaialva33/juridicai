import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import env from '#start/env'
import governmentSourceCatalog from '#modules/integrations/services/government_source_catalog'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import SourceRecord from '#modules/siop/models/source_record'
import { normalizeCnj } from '#modules/siop/parsers/cnj_parser'
import type { JsonRecord } from '#shared/types/model_enums'

export const DATAJUD_PUBLIC_API_KEY = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=='

export type DataJudHit = {
  _id: string
  _index: string
  _source: JsonRecord
  sort?: unknown[]
}

export type DataJudSearchResponse = {
  took: number
  timed_out: boolean
  hits: {
    total: {
      value: number
      relation: 'eq' | 'gte'
    }
    hits: DataJudHit[]
  }
}

export type DataJudSearchOptions = {
  courtAlias: string
  body: JsonRecord
  fetcher?: typeof fetch
  apiKey?: string
}

export type DataJudSyncByCnjOptions = {
  tenantId: string
  cnjNumber: string
  courtAliases: string[]
  fetcher?: typeof fetch
  apiKey?: string
}

export type DataJudSyncedProcess = {
  courtAlias: string
  hit: DataJudHit
  sourceRecord: SourceRecord
  judicialProcess: JudicialProcess
  created: boolean
}

class DataJudPublicApiAdapter {
  async search(options: DataJudSearchOptions) {
    const endpoint = this.endpointFor(options.courtAlias)
    const response = await (options.fetcher ?? fetch)(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${this.apiKey(options.apiKey)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options.body),
    })

    if (!response.ok) {
      throw new Error(
        `DataJud search failed for ${options.courtAlias} with HTTP ${response.status}: ${await response.text()}`
      )
    }

    return (await response.json()) as DataJudSearchResponse
  }

  async *searchPages(options: DataJudSearchOptions & { pageSize?: number }) {
    let searchAfter: unknown[] | undefined
    const pageSize = options.pageSize ?? 100

    do {
      const body = {
        ...options.body,
        size: pageSize,
        sort: [{ '@timestamp': { order: 'asc' } }],
        ...(searchAfter ? { search_after: searchAfter } : {}),
      }
      const page = await this.search({ ...options, body })
      const lastHit = page.hits.hits.at(-1)

      yield page

      searchAfter = lastHit?.sort
    } while (searchAfter?.length)
  }

  searchByCnj(options: Omit<DataJudSearchOptions, 'body'> & { cnjNumber: string }) {
    return this.search({
      ...options,
      body: {
        query: {
          match: {
            numeroProcesso: onlyDigits(options.cnjNumber),
          },
        },
      },
    })
  }

  async syncByCnj(options: DataJudSyncByCnjOptions) {
    const synced: DataJudSyncedProcess[] = []

    for (const courtAlias of options.courtAliases) {
      const body = {
        query: {
          match: {
            numeroProcesso: onlyDigits(options.cnjNumber),
          },
        },
      }
      const response = await this.search({
        courtAlias,
        body,
        fetcher: options.fetcher,
        apiKey: options.apiKey,
      })
      const sourceRecord = await this.persistSourceRecord({
        tenantId: options.tenantId,
        courtAlias,
        body,
        response,
      })

      for (const hit of response.hits.hits) {
        const persisted = await this.upsertJudicialProcess({
          tenantId: options.tenantId,
          courtAlias,
          sourceRecord,
          hit,
        })

        if (persisted) {
          synced.push({ courtAlias, hit, sourceRecord, ...persisted })
        }
      }
    }

    return {
      requestedCourts: options.courtAliases.length,
      synced: synced.length,
      processes: synced,
    }
  }

  private async persistSourceRecord(input: {
    tenantId: string
    courtAlias: string
    body: JsonRecord
    response: DataJudSearchResponse
  }) {
    const endpoint = this.endpointFor(input.courtAlias)
    const checksum = createHash('sha256')
      .update(JSON.stringify({ endpoint, body: input.body, response: input.response }))
      .digest('hex')
    const metadata: JsonRecord = {
      providerId: 'datajud-public-api',
      courtAlias: input.courtAlias.toLowerCase(),
      endpoint,
      query: input.body,
      total: input.response.hits.total,
      took: input.response.took,
      timedOut: input.response.timed_out,
    }
    const existing = await SourceRecord.query()
      .where('tenant_id', input.tenantId)
      .where('source', 'datajud')
      .where('source_checksum', checksum)
      .first()

    if (existing) {
      existing.merge({
        sourceUrl: endpoint,
        collectedAt: DateTime.now(),
        rawData: metadata,
      })
      await existing.save()
      return existing
    }

    return SourceRecord.create({
      tenantId: input.tenantId,
      source: 'datajud',
      sourceUrl: endpoint,
      sourceChecksum: checksum,
      collectedAt: DateTime.now(),
      rawData: metadata,
    })
  }

  private async upsertJudicialProcess(input: {
    tenantId: string
    courtAlias: string
    sourceRecord: SourceRecord
    hit: DataJudHit
  }) {
    const source = input.hit._source
    const cnjNumber = normalizeCnj(String(source.numeroProcesso ?? ''))

    if (!cnjNumber) {
      return null
    }

    const asset = await PrecatorioAsset.query()
      .where('tenant_id', input.tenantId)
      .where('cnj_number', cnjNumber)
      .first()
    const existing = await JudicialProcess.query()
      .where('tenant_id', input.tenantId)
      .where('cnj_number', cnjNumber)
      .first()
    const payload = {
      tenantId: input.tenantId,
      assetId: asset?.id ?? null,
      sourceRecordId: input.sourceRecord.id,
      source: 'datajud' as const,
      cnjNumber,
      courtCode: stringOrNull(source.tribunal) ?? input.courtAlias.toUpperCase(),
      courtName: stringOrNull(readNested(source, ['orgaoJulgador', 'nome'])),
      className: stringOrNull(readNested(source, ['classe', 'nome'])),
      subject: firstSubject(source.assuntos),
      filedAt: parseDataJudDate(source.dataAjuizamento),
      rawData: {
        datajudId: input.hit._id,
        index: input.hit._index,
        source,
        sort: input.hit.sort ?? null,
      },
    }

    if (existing) {
      existing.merge(payload)
      await existing.save()
      return { judicialProcess: existing, created: false }
    }

    const judicialProcess = await JudicialProcess.create(payload)
    return { judicialProcess, created: true }
  }

  private endpointFor(courtAlias: string) {
    const endpoint = governmentSourceCatalog.dataJudEndpoint(courtAlias)

    if (!endpoint) {
      throw new Error(`Unsupported DataJud court alias: ${courtAlias}.`)
    }

    return endpoint
  }

  private apiKey(apiKey?: string) {
    return apiKey ?? env.get('DATAJUD_API_KEY') ?? DATAJUD_PUBLIC_API_KEY
  }
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function readNested(record: JsonRecord, path: string[]) {
  let current: unknown = record

  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return null
    }

    current = (current as JsonRecord)[key]
  }

  return current
}

function stringOrNull(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function firstSubject(value: unknown) {
  if (!Array.isArray(value)) {
    return null
  }

  const flattened = value.flat(2)
  const subject = flattened.find(
    (item): item is JsonRecord => !!item && typeof item === 'object' && !Array.isArray(item)
  )

  return stringOrNull(subject?.nome)
}

function parseDataJudDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const trimmed = value.trim()
  const parsed = /^\d{14}$/.test(trimmed)
    ? DateTime.fromFormat(trimmed, 'yyyyLLddHHmmss')
    : /^\d{8}$/.test(trimmed)
      ? DateTime.fromFormat(trimmed, 'yyyyLLdd')
      : DateTime.fromISO(trimmed)

  return parsed.isValid ? parsed.startOf('day') : null
}

export default new DataJudPublicApiAdapter()
