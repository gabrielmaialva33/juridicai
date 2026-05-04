import CessionOpportunity, {
  type OpportunityGrade,
} from '#modules/operations/models/cession_opportunity'
import CessionPricing from '#modules/operations/models/cession_pricing'
import CessionStageHistory from '#modules/operations/models/cession_stage_history'
import cessionPricingEngine from '#modules/operations/services/cession_pricing_engine'
import marketRateService from '#modules/market/services/market_rate_service'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import type AssetEvent from '#modules/precatorios/models/asset_event'
import assetSignalScoreService from '#modules/precatorios/services/asset_signal_score_service'
import type { JsonRecord, SourceType } from '#shared/types/model_enums'

const DEFAULT_LIMIT = 500
const DEFAULT_MIN_GRADE: OpportunityGrade = 'A'
const DEFAULT_MIN_RISK_ADJUSTED_IRR = 0.25

export type PostImportOperationalIntakeOptions = {
  tenantId: string
  assetIds?: string[] | null
  sourceRecordId?: string | null
  sourceRecordIds?: string[] | null
  source?: SourceType | null
  limit?: number | null
  minGrade?: OpportunityGrade | null
  minRiskAdjustedIrr?: number | null
  createOpportunities?: boolean | null
}

export type PostImportOperationalIntakeResult = {
  inspectedAssets: number
  scoresRefreshed: number
  scoresCreated: number
  opportunitiesCreated: number
  opportunitiesUpdated: number
  opportunitiesSkipped: number
}

class PostImportOperationalIntakeService {
  async run(
    options: PostImportOperationalIntakeOptions
  ): Promise<PostImportOperationalIntakeResult> {
    const assets = await this.findAssets(options)
    const marketRates = await marketRateService.latestSnapshot()
    const result: PostImportOperationalIntakeResult = {
      inspectedAssets: assets.length,
      scoresRefreshed: 0,
      scoresCreated: 0,
      opportunitiesCreated: 0,
      opportunitiesUpdated: 0,
      opportunitiesSkipped: 0,
    }

    for (const asset of assets) {
      const score = await assetSignalScoreService.refresh(options.tenantId, asset.id)
      asset.currentScore = score.score.finalScore
      asset.currentScoreId = score.score.id
      result.scoresRefreshed += 1
      result.scoresCreated += score.created ? 1 : 0

      if (options.createOpportunities === false) {
        result.opportunitiesSkipped += 1
        continue
      }

      const opportunity = asset.$preloaded.cessionOpportunity as CessionOpportunity | undefined
      const projection = cessionPricingEngine.project(asset, {
        debtor: asset.debtor,
        events: (asset.events ?? []) as AssetEvent[],
        marketRates,
        stage: opportunity?.stage ?? 'inbox',
        opportunityId: opportunity?.id ?? null,
        priority: opportunity?.priority ?? 0,
        targetCloseAt: opportunity?.targetCloseAt?.toISO() ?? null,
        lastContactedAt: opportunity?.lastContactedAt?.toISO() ?? null,
      })

      if (!shouldCreateOpportunity(projection.pricing, options)) {
        result.opportunitiesSkipped += 1
        continue
      }

      const wasCreated = await this.upsertOpportunity({
        tenantId: options.tenantId,
        asset,
        existing: opportunity ?? null,
        pricing: projection.pricing,
      })

      if (wasCreated) {
        result.opportunitiesCreated += 1
      } else {
        result.opportunitiesUpdated += 1
      }
    }

    return result
  }

  private findAssets(options: PostImportOperationalIntakeOptions) {
    const sourceRecordIds = uniqueIds([
      ...(options.sourceRecordIds ?? []),
      ...(options.sourceRecordId ? [options.sourceRecordId] : []),
    ])
    const query = PrecatorioAsset.query()
      .where('tenant_id', options.tenantId)
      .whereNull('deleted_at')
      .preload('debtor', (debtorQuery) =>
        debtorQuery.preload('paymentStats', (statsQuery) =>
          statsQuery.orderBy('computed_at', 'desc').limit(1)
        )
      )
      .preload('events', (eventQuery) => eventQuery.orderBy('event_date', 'desc').limit(100))
      .preload('valuations', (valuationQuery) =>
        valuationQuery.orderBy('computed_at', 'desc').limit(1)
      )
      .preload('cessionOpportunity', (opportunityQuery) =>
        opportunityQuery.preload('currentPricing')
      )
      .orderBy('created_at', 'desc')
      .limit(normalizeLimit(options.limit))

    if (sourceRecordIds.length > 0) {
      query.whereIn('source_record_id', sourceRecordIds)
    }

    if (options.assetIds?.length) {
      query.whereIn('id', uniqueIds(options.assetIds))
    }

    if (options.source) {
      query.where('source', options.source)
    }

    return query.exec()
  }

  private async upsertOpportunity(input: {
    tenantId: string
    asset: PrecatorioAsset
    existing: CessionOpportunity | null
    pricing: ReturnType<typeof cessionPricingEngine.calculate>
  }) {
    const opportunity = input.existing ?? new CessionOpportunity()
    const wasCreated = !input.existing
    const metadata = {
      ...(input.existing?.metadata ?? {}),
      postImportOperationalIntake: {
        modelVersion: input.pricing.assumptions.version,
        decision: input.pricing.decision,
        riskAdjustedIrr: input.pricing.riskAdjustedIrr,
        finalScore: input.pricing.finalScore,
      },
    } satisfies JsonRecord

    opportunity.merge({
      tenantId: input.tenantId,
      assetId: input.asset.id,
      stage: input.existing?.stage ?? 'inbox',
      grade: input.pricing.grade,
      priority: input.existing?.priority ?? gradePriority(input.pricing.grade),
      targetCloseAt: input.existing?.targetCloseAt ?? null,
      lastContactedAt: input.existing?.lastContactedAt ?? null,
      metadata,
      notes: input.existing?.notes ?? null,
      createdByUserId: input.existing?.createdByUserId ?? null,
      updatedByUserId: null,
    })
    await opportunity.save()

    const currentPricing = await CessionPricing.create({
      tenantId: input.tenantId,
      opportunityId: opportunity.id,
      offerRate: String(input.pricing.offerRate),
      offerValue: String(input.pricing.acquisitionCost),
      termMonths: input.pricing.termMonths,
      expectedAnnualIrr: String(input.pricing.expectedAnnualIrr),
      riskAdjustedIrr: String(input.pricing.riskAdjustedIrr),
      paymentProbability: String(input.pricing.paymentProbability),
      finalScore: String(input.pricing.finalScore),
      modelVersion: input.pricing.assumptions.version,
      pricingSnapshot: input.pricing,
      createdByUserId: null,
    })
    opportunity.currentPricingId = currentPricing.id
    await opportunity.save()

    if (wasCreated) {
      await CessionStageHistory.create({
        tenantId: input.tenantId,
        opportunityId: opportunity.id,
        fromStage: null,
        toStage: 'inbox',
        changedByUserId: null,
        reason: 'post_import_operational_intake',
      })
    }

    return wasCreated
  }
}

function shouldCreateOpportunity(
  pricing: ReturnType<typeof cessionPricingEngine.calculate>,
  options: PostImportOperationalIntakeOptions
) {
  if (pricing.faceValue <= 0 || pricing.decision === 'avoid') {
    return false
  }

  const minGrade = options.minGrade ?? DEFAULT_MIN_GRADE
  const minRiskAdjustedIrr = normalizeRate(
    options.minRiskAdjustedIrr,
    DEFAULT_MIN_RISK_ADJUSTED_IRR
  )

  return (
    gradeRank(pricing.grade) >= gradeRank(minGrade) || pricing.riskAdjustedIrr >= minRiskAdjustedIrr
  )
}

function gradePriority(grade: OpportunityGrade) {
  switch (grade) {
    case 'A+':
      return 100
    case 'A':
      return 80
    case 'B+':
      return 60
    case 'B':
      return 40
    case 'C':
      return 20
    case 'D':
      return 0
  }
}

function gradeRank(grade: OpportunityGrade) {
  switch (grade) {
    case 'A+':
      return 5
    case 'A':
      return 4
    case 'B+':
      return 3
    case 'B':
      return 2
    case 'C':
      return 1
    case 'D':
      return 0
  }
}

function normalizeRate(value: number | null | undefined, fallback: number) {
  const rate = value ?? fallback
  return rate > 1 ? rate / 100 : rate
}

function normalizeLimit(value: number | null | undefined) {
  if (!value || value < 1) {
    return DEFAULT_LIMIT
  }

  return Math.trunc(value)
}

function uniqueIds(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

export const postImportOperationalIntakeService = new PostImportOperationalIntakeService()
export default postImportOperationalIntakeService
