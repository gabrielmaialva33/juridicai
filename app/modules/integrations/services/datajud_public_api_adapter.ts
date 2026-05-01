import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import env from '#start/env'
import governmentSourceCatalog from '#modules/integrations/services/government_source_catalog'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import JudicialProcessMovement from '#modules/precatorios/models/judicial_process_movement'
import JudicialProcessMovementComplement from '#modules/precatorios/models/judicial_process_movement_complement'
import JudicialProcessSubject from '#modules/precatorios/models/judicial_process_subject'
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

export type DataJudPersistHitOptions = {
  tenantId: string
  courtAlias: string
  query: JsonRecord
  response: DataJudSearchResponse
  hit: DataJudHit
}

export type DataJudSyncedProcess = {
  courtAlias: string
  hit: DataJudHit
  sourceRecord: SourceRecord
  judicialProcess: JudicialProcess
  created: boolean
  subjectsUpserted: number
  movementsUpserted: number
  movementComplementsUpserted: number
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
          const metadata = await this.upsertJudicialProcessMetadata({
            tenantId: options.tenantId,
            sourceRecord,
            hit,
            judicialProcess: persisted.judicialProcess,
          })

          synced.push({ courtAlias, hit, sourceRecord, ...persisted, ...metadata })
        }
      }
    }

    return {
      requestedCourts: options.courtAliases.length,
      synced: synced.length,
      processes: synced,
    }
  }

  async persistHit(options: DataJudPersistHitOptions) {
    const sourceRecord = await this.persistSourceRecord({
      tenantId: options.tenantId,
      courtAlias: options.courtAlias,
      body: options.query,
      response: options.response,
    })
    const persisted = await this.upsertJudicialProcess({
      tenantId: options.tenantId,
      courtAlias: options.courtAlias,
      sourceRecord,
      hit: options.hit,
    })

    if (!persisted) {
      return null
    }

    const metadata = await this.upsertJudicialProcessMetadata({
      tenantId: options.tenantId,
      sourceRecord,
      hit: options.hit,
      judicialProcess: persisted.judicialProcess,
    })

    return {
      courtAlias: options.courtAlias,
      hit: options.hit,
      sourceRecord,
      ...persisted,
      ...metadata,
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
      datajudId: input.hit._id,
      datajudIndex: input.hit._index,
      courtAlias: input.courtAlias.toLowerCase(),
      courtCode: stringOrNull(source.tribunal) ?? input.courtAlias.toUpperCase(),
      courtName: stringOrNull(readNested(source, ['orgaoJulgador', 'nome'])),
      degree: stringOrNull(source.grau),
      secrecyLevel: numberOrNull(source.nivelSigilo),
      systemCode: numberOrNull(readNested(source, ['sistema', 'codigo'])),
      systemName: stringOrNull(readNested(source, ['sistema', 'nome'])),
      formatCode: numberOrNull(readNested(source, ['formato', 'codigo'])),
      formatName: stringOrNull(readNested(source, ['formato', 'nome'])),
      classCode: numberOrNull(readNested(source, ['classe', 'codigo'])),
      className: stringOrNull(readNested(source, ['classe', 'nome'])),
      subject: firstSubject(source.assuntos),
      judgingBodyCode: stringFromUnknown(readNested(source, ['orgaoJulgador', 'codigo'])),
      judgingBodyName: stringOrNull(readNested(source, ['orgaoJulgador', 'nome'])),
      judgingBodyMunicipalityIbgeCode: numberOrNull(
        readNested(source, ['orgaoJulgador', 'codigoMunicipioIBGE'])
      ),
      filedAt: parseDataJudDate(source.dataAjuizamento),
      datajudUpdatedAt: parseDataJudDateTime(source.dataHoraUltimaAtualizacao),
      datajudIndexedAt: parseDataJudDateTime(source['@timestamp']),
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

  private async upsertJudicialProcessMetadata(input: {
    tenantId: string
    sourceRecord: SourceRecord
    hit: DataJudHit
    judicialProcess: JudicialProcess
  }) {
    const subjectsUpserted = await this.upsertJudicialProcessSubjects(input)
    const movementMetrics = await this.upsertJudicialProcessMovements(input)

    return {
      subjectsUpserted,
      movementsUpserted: movementMetrics.movementsUpserted,
      movementComplementsUpserted: movementMetrics.complementsUpserted,
    }
  }

  private async upsertJudicialProcessSubjects(input: {
    tenantId: string
    sourceRecord: SourceRecord
    hit: DataJudHit
    judicialProcess: JudicialProcess
  }) {
    const subjects = extractDataJudSubjects(input.hit._source, input.judicialProcess.cnjNumber)
    let upserted = 0

    for (const subject of subjects) {
      await JudicialProcessSubject.updateOrCreate(
        {
          tenantId: input.tenantId,
          idempotencyKey: subject.idempotencyKey,
        },
        {
          tenantId: input.tenantId,
          processId: input.judicialProcess.id,
          sourceRecordId: input.sourceRecord.id,
          subjectCode: subject.code,
          subjectName: subject.name,
          sequence: subject.sequence,
          rawData: subject.rawData,
          idempotencyKey: subject.idempotencyKey,
        }
      )
      upserted += 1
    }

    return upserted
  }

  private async upsertJudicialProcessMovements(input: {
    tenantId: string
    sourceRecord: SourceRecord
    hit: DataJudHit
    judicialProcess: JudicialProcess
  }) {
    const movements = extractDataJudMovements(input.hit._source, input.judicialProcess.cnjNumber)
    let movementsUpserted = 0
    let complementsUpserted = 0

    for (const movement of movements) {
      const movementRow = await JudicialProcessMovement.updateOrCreate(
        {
          tenantId: input.tenantId,
          idempotencyKey: movement.idempotencyKey,
        },
        {
          tenantId: input.tenantId,
          processId: input.judicialProcess.id,
          sourceRecordId: input.sourceRecord.id,
          source: 'datajud',
          movementCode: movement.code,
          movementName: movement.name,
          occurredAt: movement.occurredAt,
          sequence: movement.sequence,
          judgingBodyCode: movement.judgingBodyCode,
          judgingBodyName: movement.judgingBodyName,
          judgingBodyMunicipalityIbgeCode: movement.judgingBodyMunicipalityIbgeCode,
          rawData: movement.rawData,
          idempotencyKey: movement.idempotencyKey,
        }
      )
      movementsUpserted += 1
      complementsUpserted += await this.upsertJudicialProcessMovementComplements({
        tenantId: input.tenantId,
        sourceRecord: input.sourceRecord,
        movement: movementRow,
        complements: movement.complements,
      })
    }

    return { movementsUpserted, complementsUpserted }
  }

  private async upsertJudicialProcessMovementComplements(input: {
    tenantId: string
    sourceRecord: SourceRecord
    movement: JudicialProcessMovement
    complements: DataJudMovementComplement[]
  }) {
    let upserted = 0

    for (const complement of input.complements) {
      await JudicialProcessMovementComplement.updateOrCreate(
        {
          tenantId: input.tenantId,
          idempotencyKey: complement.idempotencyKey,
        },
        {
          tenantId: input.tenantId,
          movementId: input.movement.id,
          sourceRecordId: input.sourceRecord.id,
          complementCode: complement.code,
          complementValue: complement.value,
          complementName: complement.name,
          complementDescription: complement.description,
          sequence: complement.sequence,
          rawData: complement.rawData,
          idempotencyKey: complement.idempotencyKey,
        }
      )
      upserted += 1
    }

    return upserted
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

function stringFromUnknown(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value))
  }

  return stringOrNull(value)
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

type DataJudMovementComplement = {
  code: number | null
  value: number | null
  name: string | null
  description: string | null
  sequence: number | null
  rawData: JsonRecord
  idempotencyKey: string
}

function extractDataJudSubjects(source: JsonRecord, cnjNumber: string) {
  if (!Array.isArray(source.assuntos)) {
    return []
  }

  return source.assuntos
    .flat(2)
    .filter((subject): subject is JsonRecord => {
      return !!subject && typeof subject === 'object' && !Array.isArray(subject)
    })
    .map((subject, index) => {
      const code = numberOrNull(subject.codigo)
      const name = stringOrNull(subject.nome) ?? 'Unknown subject'
      const sequence = index + 1
      const idempotencyKey = createHash('sha256')
        .update(JSON.stringify({ source: 'datajud', cnjNumber, code, name }))
        .digest('hex')

      return {
        code,
        name,
        sequence,
        rawData: subject,
        idempotencyKey,
      }
    })
}

function extractDataJudMovements(source: JsonRecord, cnjNumber: string) {
  if (!Array.isArray(source.movimentos)) {
    return []
  }

  return source.movimentos
    .filter((movement): movement is JsonRecord => {
      return !!movement && typeof movement === 'object' && !Array.isArray(movement)
    })
    .map((movement, index) => {
      const code = numberOrNull(movement.codigo)
      const name = stringOrNull(movement.nome) ?? 'Unknown movement'
      const occurredAt = parseDataJudDateTime(movement.dataHora)
      const sequence = numberOrNull(movement.identificadorMovimento) ?? index + 1
      const judgingBodyCode = stringFromUnknown(readNested(movement, ['orgaoJulgador', 'codigo']))
      const judgingBodyName = stringOrNull(readNested(movement, ['orgaoJulgador', 'nome']))
      const judgingBodyMunicipalityIbgeCode = numberOrNull(
        readNested(movement, ['orgaoJulgador', 'codigoMunicipioIBGE'])
      )
      const idempotencyKey = createHash('sha256')
        .update(
          JSON.stringify({
            source: 'datajud',
            cnjNumber,
            sequence,
            code,
            name,
            occurredAt: occurredAt?.toISO() ?? null,
          })
        )
        .digest('hex')

      return {
        code,
        name,
        occurredAt,
        sequence,
        judgingBodyCode,
        judgingBodyName,
        judgingBodyMunicipalityIbgeCode,
        complements: extractDataJudMovementComplements(movement, idempotencyKey),
        rawData: movement,
        idempotencyKey,
      }
    })
}

function extractDataJudMovementComplements(
  movement: JsonRecord,
  movementIdempotencyKey: string
): DataJudMovementComplement[] {
  if (!Array.isArray(movement.complementosTabelados)) {
    return []
  }

  return movement.complementosTabelados
    .filter((complement): complement is JsonRecord => {
      return !!complement && typeof complement === 'object' && !Array.isArray(complement)
    })
    .map((complement, index) => {
      const code = numberOrNull(complement.codigo)
      const value = numberOrNull(complement.valor)
      const name = stringOrNull(complement.nome)
      const description = stringOrNull(complement.descricao)
      const sequence = index + 1
      const idempotencyKey = createHash('sha256')
        .update(
          JSON.stringify({
            source: 'datajud',
            movementIdempotencyKey,
            sequence,
            code,
            value,
            name,
            description,
          })
        )
        .digest('hex')

      return {
        code,
        value,
        name,
        description,
        sequence,
        rawData: complement,
        idempotencyKey,
      }
    })
}

function numberOrNull(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
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

function parseDataJudDateTime(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const trimmed = value.trim()
  const parsed = /^\d{14}$/.test(trimmed)
    ? DateTime.fromFormat(trimmed, 'yyyyLLddHHmmss', { zone: 'utc' })
    : /^\d{8}$/.test(trimmed)
      ? DateTime.fromFormat(trimmed, 'yyyyLLdd', { zone: 'utc' })
      : DateTime.fromISO(trimmed, { setZone: true })

  return parsed.isValid ? parsed.toUTC() : null
}

export default new DataJudPublicApiAdapter()
