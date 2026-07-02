import BaseRepository from '#shared/repositories/base_repository'
import CessionOpportunity, {
  type CessionPipelineStage,
  type OpportunityGrade,
} from '#modules/operations/models/cession_opportunity'
import type { DateTime } from 'luxon'
import type { JsonRecord } from '#shared/types/model_enums'

class CessionOpportunityRepository extends BaseRepository<typeof CessionOpportunity> {
  constructor() {
    super(CessionOpportunity)
  }

  findByAsset(tenantId: string, assetId: string) {
    return this.query(tenantId).where('asset_id', assetId).first()
  }

  async savePipelineState(
    tenantId: string,
    opportunity: CessionOpportunity | null,
    input: {
      assetId: string
      stage: CessionPipelineStage
      grade: OpportunityGrade
      priority: number
      targetCloseAt?: DateTime | null
      lastContactedAt?: DateTime | null
      notes?: string | null
      createdByUserId?: string | null
      updatedByUserId?: string | null
      metadata?: JsonRecord | null
    }
  ) {
    const row = opportunity ?? new CessionOpportunity()
    row.merge({
      tenantId,
      assetId: input.assetId,
      stage: input.stage,
      grade: input.grade,
      priority: input.priority,
      targetCloseAt: input.targetCloseAt ?? null,
      lastContactedAt: input.lastContactedAt ?? null,
      notes: input.notes ?? null,
      metadata: input.metadata ?? opportunity?.metadata ?? null,
      createdByUserId: opportunity?.createdByUserId ?? input.createdByUserId ?? null,
      updatedByUserId: input.updatedByUserId ?? null,
    })
    await row.save()
    return row
  }

  async setCurrentPricing(opportunity: CessionOpportunity, pricingId: string) {
    opportunity.currentPricingId = pricingId
    await opportunity.save()
    return opportunity
  }
}

export default new CessionOpportunityRepository()
