import BaseRepository from '#shared/repositories/base_repository'
import CessionPricing from '#modules/operations/models/cession_pricing'
import type { JsonRecord } from '#shared/types/model_enums'

class CessionPricingRepository extends BaseRepository<typeof CessionPricing> {
  constructor() {
    super(CessionPricing)
  }

  createSnapshot(
    tenantId: string,
    input: {
      opportunityId: string
      offerRate: number
      offerValue: number
      termMonths: number
      expectedAnnualIrr: number
      riskAdjustedIrr: number
      paymentProbability: number
      finalScore: number
      modelVersion: string
      pricingSnapshot: JsonRecord
      createdByUserId?: string | null
    }
  ) {
    return this.create(tenantId, {
      opportunityId: input.opportunityId,
      offerRate: String(input.offerRate),
      offerValue: String(input.offerValue),
      termMonths: input.termMonths,
      expectedAnnualIrr: String(input.expectedAnnualIrr),
      riskAdjustedIrr: String(input.riskAdjustedIrr),
      paymentProbability: String(input.paymentProbability),
      finalScore: String(input.finalScore),
      modelVersion: input.modelVersion,
      pricingSnapshot: input.pricingSnapshot,
      createdByUserId: input.createdByUserId ?? null,
    })
  }
}

export default new CessionPricingRepository()
