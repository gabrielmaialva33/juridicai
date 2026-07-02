import BaseRepository from '#shared/repositories/base_repository'
import ProcessMatchCandidate, {
  type ProcessMatchCandidateStatus,
} from '#modules/integrations/models/process_match_candidate'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { JsonRecord, SourceType } from '#shared/types/model_enums'

type CandidateListFilters = {
  page: number
  limit: number
  assetId?: string | null
  source?: SourceType | null
  status?: ProcessMatchCandidateStatus | null
  minScore?: number | null
  maxScore?: number | null
  q?: string | null
  sortBy: 'created_at' | 'updated_at' | 'score'
  sortDirection: 'asc' | 'desc'
}

class ProcessMatchCandidateRepository extends BaseRepository<typeof ProcessMatchCandidate> {
  constructor() {
    super(ProcessMatchCandidate)
  }

  listForApi(tenantId: string, filters: CandidateListFilters) {
    const query = this.query(tenantId)
      .preload('asset', (assetQuery) =>
        assetQuery.preload('valuations', (valuationQuery) =>
          valuationQuery.orderBy('computed_at', 'desc').limit(1)
        )
      )
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

  findForApi(tenantId: string, candidateId: string) {
    return this.query(tenantId)
      .where('id', candidateId)
      .preload('asset', (assetQuery) =>
        assetQuery.preload('valuations', (valuationQuery) =>
          valuationQuery.orderBy('computed_at', 'desc').limit(1)
        )
      )
      .preload('sourceRecord')
      .firstOrFail()
  }

  listForAsset(tenantId: string, assetId: string, limit = 50) {
    return this.query(tenantId)
      .where('asset_id', assetId)
      .orderBy('score', 'desc')
      .orderBy('created_at', 'desc')
      .limit(limit)
  }

  async upsertMatch(input: {
    tenantId: string
    assetId: string
    sourceRecordId: string | null
    source: SourceType
    courtAlias: string
    candidateCnj: string
    candidateDatajudId: string
    candidateIndex: string
    score: number
    status: ProcessMatchCandidateStatus
    signals: JsonRecord
    rawData: JsonRecord
  }) {
    const existing = await this.query(input.tenantId)
      .where('asset_id', input.assetId)
      .where('candidate_cnj', input.candidateCnj)
      .where('candidate_datajud_id', input.candidateDatajudId)
      .first()
    const payload = {
      tenantId: input.tenantId,
      assetId: input.assetId,
      sourceRecordId: input.sourceRecordId,
      source: input.source,
      courtAlias: input.courtAlias,
      candidateCnj: input.candidateCnj,
      candidateDatajudId: input.candidateDatajudId,
      candidateIndex: input.candidateIndex,
      score: input.score,
      status: input.status,
      signals: input.signals,
      rawData: input.rawData,
    }

    if (existing) {
      existing.merge(payload)
      await existing.save()
      return existing
    }

    return this.create(input.tenantId, payload)
  }

  findForReview(candidateId: string, tenantId: string | undefined, trx: TransactionClientContract) {
    const query = ProcessMatchCandidate.query({ client: trx }).where('id', candidateId).forUpdate()

    if (tenantId) {
      query.where('tenant_id', tenantId)
    }

    return query.firstOrFail()
  }

  rejectOpenSiblings(candidate: ProcessMatchCandidate, trx: TransactionClientContract) {
    return ProcessMatchCandidate.query({ client: trx })
      .where('tenant_id', candidate.tenantId)
      .where('asset_id', candidate.assetId)
      .whereNot('id', candidate.id)
      .whereIn('status', ['candidate', 'ambiguous'])
      .update({ status: 'rejected' })
  }
}

export default new ProcessMatchCandidateRepository()
