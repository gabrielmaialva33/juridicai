import BaseRepository from '#shared/repositories/base_repository'
import CessionStageHistory from '#modules/operations/models/cession_stage_history'
import type { CessionPipelineStage } from '#modules/operations/models/cession_opportunity'

class CessionStageHistoryRepository extends BaseRepository<typeof CessionStageHistory> {
  constructor() {
    super(CessionStageHistory)
  }

  createTransition(
    tenantId: string,
    input: {
      opportunityId: string
      fromStage?: CessionPipelineStage | null
      toStage: CessionPipelineStage
      changedByUserId?: string | null
      reason?: string | null
    }
  ) {
    return this.create(tenantId, {
      opportunityId: input.opportunityId,
      fromStage: input.fromStage ?? null,
      toStage: input.toStage,
      changedByUserId: input.changedByUserId ?? null,
      reason: input.reason ?? null,
    })
  }
}

export default new CessionStageHistoryRepository()
