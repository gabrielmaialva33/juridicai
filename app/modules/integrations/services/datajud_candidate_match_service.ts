import db from '@adonisjs/lucid/services/db'
import dataJudPublicApiAdapter, {
  type DataJudHit,
} from '#modules/integrations/services/datajud_public_api_adapter'
import { inferDataJudCourtAliases } from '#modules/integrations/services/datajud_asset_enrichment_service'
import ProcessMatchCandidate, {
  type ProcessMatchCandidateStatus,
} from '#modules/integrations/models/process_match_candidate'
import { normalizeCnj } from '#modules/siop/parsers/cnj_parser'
import type { JsonRecord, SourceType } from '#shared/types/model_enums'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 500
const DEFAULT_CANDIDATES_PER_ASSET = 5
const MAX_CANDIDATES_PER_ASSET = 20

type CandidateAssetRow = {
  id: string
  tenant_id: string
  source_record_id: string | null
  source: SourceType
  cnj_number: string | null
  exercise_year: number | null
  court_code: string | null
  court_name: string | null
  cause_type: string | null
  origin_filed_at: Date | string | null
  autuated_at: Date | string | null
  raw_data: JsonRecord | null
}

export type DataJudCandidateMatchOptions = {
  tenantId: string
  sourceRecordId?: string | null
  source?: SourceType | null
  limit?: number | null
  candidatesPerAsset?: number | null
  persist?: boolean
  fetcher?: typeof fetch
  apiKey?: string
}

export type DataJudCandidateMatchStats = {
  selected: number
  attempted: number
  candidates: number
  upserted: number
  invalidCnj: number
  noCourt: number
  errors: number
}

export type DataJudCandidateMatch = {
  assetId: string
  requestedCnj: string | null
  courtAlias: string
  candidateCnj: string
  candidateDatajudId: string
  candidateIndex: string
  score: number
  signals: JsonRecord
  rawData: JsonRecord
}

class DataJudCandidateMatchService {
  async match(options: DataJudCandidateMatchOptions) {
    const assets = await this.findAssets(options)
    const stats: DataJudCandidateMatchStats = {
      selected: assets.length,
      attempted: 0,
      candidates: 0,
      upserted: 0,
      invalidCnj: 0,
      noCourt: 0,
      errors: 0,
    }
    const matches: DataJudCandidateMatch[] = []

    for (const asset of assets) {
      const cnjNumber = normalizeCnj(asset.cnj_number)
      const plan = cnjNumber
        ? exactCnjSearchPlan(cnjNumber, options, asset)
        : metadataSearchPlan(asset, options)
      if (!cnjNumber && !plan) {
        stats.noCourt += 1
        continue
      }
      if (asset.cnj_number && !cnjNumber) {
        stats.invalidCnj += 1
        continue
      }

      const courtAlias = plan?.courtAlias
      if (!courtAlias) {
        stats.noCourt += 1
        continue
      }

      try {
        stats.attempted += 1
        const response = await dataJudPublicApiAdapter.search({
          courtAlias,
          body: plan.body,
          fetcher: options.fetcher,
          apiKey: options.apiKey,
        })
        const assetMatches = response.hits.hits
          .map((hit) => buildMatch(asset, cnjNumber, courtAlias, hit))
          .filter((match) => match.score > 0)
          .sort((left, right) => right.score - left.score)

        stats.candidates += assetMatches.length
        matches.push(...assetMatches)

        if (options.persist) {
          for (const match of assetMatches) {
            await this.persistMatch(asset, match)
            stats.upserted += 1
          }
        }
      } catch {
        stats.errors += 1
      }
    }

    return { stats, matches }
  }

  private findAssets(options: DataJudCandidateMatchOptions) {
    const query = db
      .from('precatorio_assets')
      .select(
        'precatorio_assets.id',
        'precatorio_assets.tenant_id',
        'precatorio_assets.source_record_id',
        'precatorio_assets.source',
        'precatorio_assets.cnj_number',
        'precatorio_assets.exercise_year',
        'courts.code as court_code',
        'courts.name as court_name',
        'asset_budget_facts.cause_type',
        'precatorio_assets.origin_filed_at',
        'precatorio_assets.autuated_at',
        'precatorio_assets.raw_data'
      )
      .leftJoin('courts', 'courts.id', 'precatorio_assets.court_id')
      .leftJoin('asset_budget_facts', (join) => {
        join
          .on('asset_budget_facts.asset_id', 'precatorio_assets.id')
          .andOn('asset_budget_facts.tenant_id', 'precatorio_assets.tenant_id')
      })
      .where('precatorio_assets.tenant_id', options.tenantId)
      .whereNull('precatorio_assets.deleted_at')
      .where((builder) => {
        builder
          .whereNotNull('cnj_number')
          .orWhereNotNull('courts.name')
          .orWhereNotNull('courts.code')
      })
      .orderBy('precatorio_assets.created_at', 'asc')
      .limit(normalizeLimit(options.limit))

    if (options.source) {
      query.where('precatorio_assets.source', options.source)
    }

    if (options.sourceRecordId) {
      query.where('precatorio_assets.source_record_id', options.sourceRecordId)
    }

    return query as Promise<CandidateAssetRow[]>
  }

  private async persistMatch(asset: CandidateAssetRow, match: DataJudCandidateMatch) {
    const existing = await ProcessMatchCandidate.query()
      .where('tenant_id', asset.tenant_id)
      .where('asset_id', asset.id)
      .where('candidate_cnj', match.candidateCnj)
      .where('candidate_datajud_id', match.candidateDatajudId)
      .first()
    const payload = {
      tenantId: asset.tenant_id,
      assetId: asset.id,
      sourceRecordId: asset.source_record_id,
      source: 'datajud' as const,
      courtAlias: match.courtAlias,
      candidateCnj: match.candidateCnj,
      candidateDatajudId: match.candidateDatajudId,
      candidateIndex: match.candidateIndex,
      score: match.score,
      status: classifyStatus(match.score),
      signals: match.signals,
      rawData: match.rawData,
    }

    if (existing) {
      existing.merge(payload)
      await existing.save()
      return existing
    }

    return ProcessMatchCandidate.create(payload)
  }
}

function buildMatch(
  asset: CandidateAssetRow,
  requestedCnj: string | null,
  courtAlias: string,
  hit: DataJudHit
): DataJudCandidateMatch {
  const source = hit._source
  const candidateCnj = normalizeCnj(String(source.numeroProcesso ?? '')) ?? ''
  const signals = scoreSignals(asset, requestedCnj, candidateCnj, source)
  const score = scoreFromSignals(signals)

  return {
    assetId: asset.id,
    requestedCnj,
    courtAlias,
    candidateCnj,
    candidateDatajudId: hit._id,
    candidateIndex: hit._index,
    score: Math.min(score, 100),
    signals,
    rawData: {
      datajudId: hit._id,
      index: hit._index,
      source,
      sort: hit.sort ?? null,
    },
  }
}

function scoreSignals(
  asset: CandidateAssetRow,
  requestedCnj: string | null,
  candidateCnj: string,
  source: JsonRecord
) {
  const requestedDigits = requestedCnj ? onlyDigits(requestedCnj) : ''
  const candidateDigits = onlyDigits(candidateCnj)
  const requestedPrefix = requestedDigits.slice(0, 7)
  const requestedYear = requestedDigits.slice(9, 13)
  const candidateYear = candidateDigits.slice(9, 13)
  const requestedSegmentCourt = requestedDigits.slice(13, 16)
  const candidateSegmentCourt = candidateDigits.slice(13, 16)
  const className = stringOrNull(readNested(source, ['classe', 'nome']))?.toLowerCase() ?? ''
  const subject = firstSubject(source.assuntos)?.toLowerCase() ?? ''
  const assetProposalYear = asset.exercise_year ? String(asset.exercise_year) : null
  const processFiledYear = dataJudYear(source.dataAjuizamento)
  const assetReferenceYear = dateYear(asset.autuated_at) ?? dateYear(asset.origin_filed_at)

  return {
    prefix: requestedPrefix && candidateDigits.startsWith(requestedPrefix) ? 35 : 0,
    sameYear: requestedYear && requestedYear === candidateYear ? 20 : 0,
    sameSegmentCourt:
      requestedSegmentCourt && requestedSegmentCourt === candidateSegmentCourt ? 15 : 0,
    proposalYear: assetProposalYear && assetProposalYear === candidateYear ? 10 : 0,
    processDate:
      !requestedCnj && assetReferenceYear && processFiledYear === assetReferenceYear ? 20 : 0,
    closeProposalYear:
      !requestedCnj &&
      assetProposalYear &&
      processFiledYear &&
      Math.abs(Number(assetProposalYear) - Number(processFiledYear)) <= 2
        ? 10
        : 0,
    precatorioClass: /precat[oó]rio|requisi[cç][aã]o de pequeno valor|rpv/.test(className) ? 25 : 0,
    executionClass: /cumprimento|execu[cç][aã]o|fazenda/.test(className) ? 15 : 0,
    causeSubject: causeMatchesSubject(asset.cause_type, subject) ? 15 : 0,
    benefitSubject: /aposentadoria|previd|benef[ií]cio|servidor|sal[aá]rio/.test(subject) ? 5 : 0,
  }
}

function classifyStatus(score: number): ProcessMatchCandidateStatus {
  if (score >= 85) {
    return 'candidate'
  }

  if (score >= 60) {
    return 'ambiguous'
  }

  return 'candidate'
}

function scoreFromSignals(signals: ReturnType<typeof scoreSignals>) {
  return Object.values(signals).reduce((total, value) => total + value, 0)
}

function exactCnjSearchPlan(
  cnjNumber: string,
  options: DataJudCandidateMatchOptions,
  asset: CandidateAssetRow
) {
  const [courtAlias] = inferDataJudCourtAliases(cnjNumber)
  if (!courtAlias) {
    return null
  }

  return {
    courtAlias,
    body: {
      size: normalizeCandidatesPerAsset(options.candidatesPerAsset),
      query: {
        wildcard: {
          numeroProcesso: `${cnjPrefix(cnjNumber)}*`,
        },
      },
      _source: metadataSourceFields(asset),
    },
  }
}

function metadataSearchPlan(asset: CandidateAssetRow, options: DataJudCandidateMatchOptions) {
  const courtAlias = inferCourtAliasFromAsset(asset)
  if (!courtAlias) {
    return null
  }

  const dateRange = dataJudDateRange(asset.autuated_at ?? asset.origin_filed_at)
  const filters: JsonRecord[] = [
    {
      terms: {
        'classe.codigo': [1265, 1266],
      },
    },
  ]

  if (dateRange) {
    filters.push({
      range: {
        dataAjuizamento: dateRange,
      },
    })
  }

  return {
    courtAlias,
    body: {
      size: normalizeCandidatesPerAsset(options.candidatesPerAsset),
      query: {
        bool: {
          filter: filters,
        },
      },
      _source: metadataSourceFields(asset),
    },
  }
}

function metadataSourceFields(_asset: CandidateAssetRow) {
  return [
    'numeroProcesso',
    'tribunal',
    'grau',
    'classe',
    'assuntos',
    'orgaoJulgador',
    'dataAjuizamento',
    'dataHoraUltimaAtualizacao',
  ]
}

function inferCourtAliasFromAsset(asset: CandidateAssetRow) {
  const courtName = normalizeText(asset.court_name)
  const courtCode = normalizeText(asset.court_code)
  const text = `${courtName} ${courtCode}`.trim()

  const trfMatch = text.match(/\btrf\s*([1-6])\b/) ?? text.match(/federal.*\b([1-6])a?\b.*regiao/)
  if (trfMatch?.[1]) {
    return `trf${trfMatch[1]}`
  }

  return null
}

function dataJudDateRange(value: Date | string | null) {
  const year = dateYear(value)
  if (!year) {
    return null
  }

  return {
    gte: `${year}-01-01`,
    lte: `${year}-12-31`,
  }
}

function dataJudYear(value: unknown) {
  const text = stringOrNull(value)
  if (!text) {
    return null
  }

  return text.slice(0, 4)
}

function dateYear(value: Date | string | null) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return String(value.getUTCFullYear())
  }

  const text = String(value)
  return /^\d{4}/.test(text) ? text.slice(0, 4) : null
}

function causeMatchesSubject(causeType: string | null, subject: string) {
  const cause = normalizeText(causeType)
  const normalizedSubject = normalizeText(subject)

  if (!cause || !normalizedSubject) {
    return false
  }

  return cause
    .split(/\s+/)
    .filter((word) => word.length >= 5)
    .some((word) => normalizedSubject.includes(word))
}

function cnjPrefix(cnjNumber: string) {
  return onlyDigits(cnjNumber).slice(0, 7)
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function normalizeText(value: string | null) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeLimit(limit?: number | null) {
  if (!limit || limit < 1) {
    return DEFAULT_LIMIT
  }

  return Math.min(Math.floor(limit), MAX_LIMIT)
}

function normalizeCandidatesPerAsset(limit?: number | null) {
  if (!limit || limit < 1) {
    return DEFAULT_CANDIDATES_PER_ASSET
  }

  return Math.min(Math.floor(limit), MAX_CANDIDATES_PER_ASSET)
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

  const subject = value
    .flat(2)
    .find((item): item is JsonRecord => !!item && typeof item === 'object' && !Array.isArray(item))

  return stringOrNull(subject?.nome)
}

export default new DataJudCandidateMatchService()
