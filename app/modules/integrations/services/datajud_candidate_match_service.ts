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
  raw_data: JsonRecord | null
}

export type DataJudCandidateMatchOptions = {
  tenantId: string
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
  requestedCnj: string
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
      if (!cnjNumber) {
        stats.invalidCnj += 1
        continue
      }

      const [courtAlias] = inferDataJudCourtAliases(cnjNumber)
      if (!courtAlias) {
        stats.noCourt += 1
        continue
      }

      try {
        stats.attempted += 1
        const response = await dataJudPublicApiAdapter.search({
          courtAlias,
          body: {
            size: normalizeCandidatesPerAsset(options.candidatesPerAsset),
            query: {
              wildcard: {
                numeroProcesso: `${cnjPrefix(cnjNumber)}*`,
              },
            },
          },
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
        'id',
        'tenant_id',
        'source_record_id',
        'source',
        'cnj_number',
        'exercise_year',
        'raw_data'
      )
      .where('tenant_id', options.tenantId)
      .whereNull('deleted_at')
      .whereNotNull('cnj_number')
      .orderBy('created_at', 'asc')
      .limit(normalizeLimit(options.limit))

    if (options.source) {
      query.where('source', options.source)
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
  requestedCnj: string,
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
  requestedCnj: string,
  candidateCnj: string,
  source: JsonRecord
) {
  const requestedDigits = onlyDigits(requestedCnj)
  const candidateDigits = onlyDigits(candidateCnj)
  const requestedPrefix = requestedDigits.slice(0, 7)
  const requestedYear = requestedDigits.slice(9, 13)
  const candidateYear = candidateDigits.slice(9, 13)
  const requestedSegmentCourt = requestedDigits.slice(13, 16)
  const candidateSegmentCourt = candidateDigits.slice(13, 16)
  const className = stringOrNull(readNested(source, ['classe', 'nome']))?.toLowerCase() ?? ''
  const subject = firstSubject(source.assuntos)?.toLowerCase() ?? ''
  const assetProposalYear = asset.exercise_year ? String(asset.exercise_year) : null

  return {
    prefix: requestedPrefix && candidateDigits.startsWith(requestedPrefix) ? 35 : 0,
    sameYear: requestedYear && requestedYear === candidateYear ? 20 : 0,
    sameSegmentCourt:
      requestedSegmentCourt && requestedSegmentCourt === candidateSegmentCourt ? 15 : 0,
    proposalYear: assetProposalYear && assetProposalYear === candidateYear ? 10 : 0,
    executionClass: /cumprimento|execu[cç][aã]o|fazenda/.test(className) ? 15 : 0,
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

function cnjPrefix(cnjNumber: string) {
  return onlyDigits(cnjNumber).slice(0, 7)
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
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
