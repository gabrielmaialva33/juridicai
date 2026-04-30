import ProcessMatchCandidate, {
  type ProcessMatchCandidateStatus,
} from '#modules/integrations/models/process_match_candidate'
import type PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import type SourceRecord from '#modules/siop/models/source_record'
import type { SourceType } from '#shared/types/model_enums'

type CandidateSortBy = 'created_at' | 'updated_at' | 'score'
type SortDirection = 'asc' | 'desc'

export type DataJudCandidateListFilters = {
  page: number
  limit: number
  assetId?: string | null
  source?: SourceType | null
  status?: ProcessMatchCandidateStatus | null
  minScore?: number | null
  maxScore?: number | null
  q?: string | null
  sortBy: CandidateSortBy
  sortDirection: SortDirection
}

class DataJudCandidateApiService {
  async list(tenantId: string, filters: DataJudCandidateListFilters) {
    const query = ProcessMatchCandidate.query()
      .where('tenant_id', tenantId)
      .preload('asset')
      .preload('sourceRecord')
      .orderBy(filters.sortBy, filters.sortDirection)

    if (filters.assetId) {
      query.where('asset_id', filters.assetId)
    }

    if (filters.source) {
      query.where('source', filters.source)
    }

    if (filters.status) {
      query.where('status', filters.status)
    }

    if (filters.minScore !== null && filters.minScore !== undefined) {
      query.where('score', '>=', filters.minScore)
    }

    if (filters.maxScore !== null && filters.maxScore !== undefined) {
      query.where('score', '<=', filters.maxScore)
    }

    if (filters.q) {
      const pattern = `%${filters.q}%`
      query.where((builder) => {
        builder
          .whereILike('candidate_cnj', pattern)
          .orWhereILike('candidate_datajud_id', pattern)
          .orWhereILike('court_alias', pattern)
      })
    }

    return query.paginate(filters.page, filters.limit)
  }

  async show(tenantId: string, candidateId: string) {
    return ProcessMatchCandidate.query()
      .where('tenant_id', tenantId)
      .where('id', candidateId)
      .preload('asset')
      .preload('sourceRecord')
      .firstOrFail()
  }
}

export function serializeDataJudCandidate(
  candidate: ProcessMatchCandidate,
  options: { includeRawData?: boolean } = {}
) {
  const asset = candidate.$preloaded.asset as PrecatorioAsset | undefined
  const sourceRecord = candidate.$preloaded.sourceRecord as SourceRecord | undefined

  return {
    id: candidate.id,
    assetId: candidate.assetId,
    sourceRecordId: candidate.sourceRecordId,
    source: candidate.source,
    courtAlias: candidate.courtAlias,
    candidateCnj: candidate.candidateCnj,
    candidateDatajudId: candidate.candidateDatajudId,
    candidateIndex: candidate.candidateIndex,
    score: candidate.score,
    status: candidate.status,
    signals: candidate.signals,
    createdAt: candidate.createdAt.toISO(),
    updatedAt: candidate.updatedAt.toISO(),
    asset: asset ? serializeCandidateAsset(asset) : null,
    sourceRecord: sourceRecord ? serializeCandidateSourceRecord(sourceRecord) : null,
    ...(options.includeRawData ? { rawData: candidate.rawData } : {}),
  }
}

function serializeCandidateAsset(asset: PrecatorioAsset) {
  return {
    id: asset.id,
    source: asset.source,
    cnjNumber: asset.cnjNumber,
    originProcessNumber: asset.originProcessNumber,
    assetNumber: asset.assetNumber,
    exerciseYear: asset.exerciseYear,
    budgetYear: asset.budgetYear,
    nature: asset.nature,
    faceValue: asset.faceValue,
    estimatedUpdatedValue: asset.estimatedUpdatedValue,
    lifecycleStatus: asset.lifecycleStatus,
    complianceStatus: asset.complianceStatus,
    currentScore: asset.currentScore,
  }
}

function serializeCandidateSourceRecord(sourceRecord: SourceRecord) {
  return {
    id: sourceRecord.id,
    source: sourceRecord.source,
    sourceUrl: sourceRecord.sourceUrl,
    originalFilename: sourceRecord.originalFilename,
    mimeType: sourceRecord.mimeType,
    collectedAt: sourceRecord.collectedAt?.toISO() ?? null,
  }
}

export default new DataJudCandidateApiService()
