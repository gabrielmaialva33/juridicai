import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import CessionOpportunity, {
  type CessionPipelineStage,
  type OpportunityGrade,
} from '#modules/operations/models/cession_opportunity'
import cessionPricingEngine, {
  type OpportunityProjection,
  type PricingInput,
} from '#modules/operations/services/cession_pricing_engine'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import type AssetEvent from '#modules/precatorios/models/asset_event'

const ACTIVE_PIPELINE_STAGES: CessionPipelineStage[] = [
  'qualified',
  'contact',
  'offer',
  'due_diligence',
  'cession',
]

export type OpportunityListFilters = {
  page: number
  limit: number
  q?: string | null
  grade?: OpportunityGrade | null
  stage?: CessionPipelineStage | null
  minRiskAdjustedIrr?: number | null
  minFaceValue?: number | null
  maxFaceValue?: number | null
}

export type PipelineUpdateInput = {
  stage: CessionPipelineStage
  offerRate?: number | null
  termMonths?: number | null
  priority?: number | null
  targetCloseAt?: DateTime | null
  lastContactedAt?: DateTime | null
  notes?: string | null
  userId?: string | null
  requestId?: string | null
}

class OperationsService {
  async desk(tenantId: string) {
    const opportunities = await this.computeOpportunities(tenantId, { limit: 500 })
    const today = DateTime.now().minus({ hours: 24 })
    const inboxAPlus = opportunities.filter(
      (opportunity) => opportunity.pipeline.stage === 'inbox' && opportunity.pricing.grade === 'A+'
    )
    const activePipeline = opportunities.filter((opportunity) =>
      ACTIVE_PIPELINE_STAGES.includes(opportunity.pipeline.stage)
    )
    const portfolio = opportunities.filter(
      (opportunity) =>
        opportunity.pipeline.stage === 'paid' || opportunity.asset.lifecycleStatus === 'paid'
    )
    const criticalEvents = opportunities
      .flatMap((opportunity) =>
        [...opportunity.signals.positive, ...opportunity.signals.negative].map((signal) => ({
          assetId: opportunity.asset.id,
          debtorName: opportunity.asset.debtorName,
          grade: opportunity.pricing.grade,
          riskAdjustedIrr: opportunity.pricing.riskAdjustedIrr,
          code: signal.code,
          label: signal.label,
          polarity: signal.polarity,
          eventDate: signal.eventDate,
        }))
      )
      .filter((event) => {
        if (!event.eventDate) {
          return true
        }

        return DateTime.fromISO(event.eventDate) >= today
      })
      .slice(0, 12)

    return {
      inbox: summarize(inboxAPlus),
      pipeline: summarize(activePipeline),
      portfolio: summarize(portfolio),
      scoreDistribution: scoreDistribution(opportunities),
      criticalEvents,
      market: {
        benchmark: 'CDI',
        targetSpreadLabel: '150-200% CDI',
      },
    }
  }

  async list(tenantId: string, filters: OpportunityListFilters) {
    const computed = await this.computeOpportunities(tenantId, { limit: 1_000 })
    const filtered = computed.filter((opportunity) => matchesFilters(opportunity, filters))
    const sorted = filtered.sort(compareOpportunities)
    const page = Math.max(filters.page, 1)
    const limit = Math.max(filters.limit, 1)
    const offset = (page - 1) * limit

    return {
      opportunities: sorted.slice(offset, offset + limit),
      meta: {
        total: sorted.length,
        perPage: limit,
        currentPage: page,
        lastPage: Math.max(Math.ceil(sorted.length / limit), 1),
      },
      filters,
    }
  }

  async show(tenantId: string, assetId: string, pricing?: PricingInput | null) {
    const asset = await this.assetQuery(tenantId)
      .where('id', assetId)
      .preload('debtor')
      .preload('events', (query) => query.orderBy('event_date', 'desc').limit(100))
      .preload('cessionOpportunity')
      .preload('judicialProcesses', (query) => query.orderBy('created_at', 'desc').limit(10))
      .preload('publications', (query) => query.orderBy('publication_date', 'desc').limit(10))
      .firstOrFail()

    const opportunity = this.projectAsset(asset, pricing)

    return {
      opportunity,
      judicialProcesses: asset.judicialProcesses.map((process) => process.serialize()),
      publications: asset.publications.map((publication) => publication.serialize()),
      events: asset.events.map((event) => event.serialize()),
    }
  }

  async pipeline(tenantId: string) {
    const opportunities = await this.computeOpportunities(tenantId, { limit: 1_000 })
    const stages: CessionPipelineStage[] = [
      'inbox',
      'qualified',
      'contact',
      'offer',
      'due_diligence',
      'cession',
      'paid',
      'lost',
    ]

    return {
      stages: stages.map((stage) => {
        const items = opportunities
          .filter((opportunity) => opportunity.pipeline.stage === stage)
          .sort(compareOpportunities)

        return {
          stage,
          count: items.length,
          faceValueTotal: sum(items, (item) => item.pricing.faceValue),
          averageRiskAdjustedIrr: average(items, (item) => item.pricing.riskAdjustedIrr),
          items: items.slice(0, 50),
        }
      }),
    }
  }

  async moveToPipeline(tenantId: string, assetId: string, input: PipelineUpdateInput) {
    const details = await this.show(tenantId, assetId, {
      offerRate: input.offerRate,
      termMonths: input.termMonths,
    })
    const pricing = details.opportunity.pricing
    const existing = await CessionOpportunity.query()
      .where('tenant_id', tenantId)
      .where('asset_id', assetId)
      .first()
    const payload = {
      tenantId,
      assetId,
      stage: input.stage,
      offerRate: String(pricing.offerRate),
      offerValue: String(pricing.acquisitionCost),
      termMonths: pricing.termMonths,
      expectedAnnualIrr: String(pricing.expectedAnnualIrr),
      riskAdjustedIrr: String(pricing.riskAdjustedIrr),
      paymentProbability: String(pricing.paymentProbability),
      finalScore: String(pricing.finalScore),
      grade: pricing.grade,
      priority: input.priority ?? existing?.priority ?? gradePriority(pricing.grade),
      targetCloseAt: input.targetCloseAt ?? existing?.targetCloseAt ?? null,
      lastContactedAt: input.lastContactedAt ?? existing?.lastContactedAt ?? null,
      pricingSnapshot: pricing,
      notes: input.notes ?? existing?.notes ?? null,
      updatedByUserId: input.userId ?? null,
    }
    const opportunity = existing ?? new CessionOpportunity()

    opportunity.merge({
      ...payload,
      createdByUserId: existing?.createdByUserId ?? input.userId ?? null,
    })
    await opportunity.save()
    await this.writeAuditLog(tenantId, assetId, opportunity, input)

    return this.show(tenantId, assetId)
  }

  async bulkMoveToPipeline(
    tenantId: string,
    input: {
      assetIds: string[]
      stage: CessionPipelineStage
      userId?: string | null
      requestId?: string | null
    }
  ) {
    const results = []

    for (const assetId of input.assetIds) {
      results.push(
        await this.moveToPipeline(tenantId, assetId, {
          stage: input.stage,
          userId: input.userId,
          requestId: input.requestId,
        })
      )
    }

    return {
      moved: results.length,
      opportunities: results.map((result) => result.opportunity),
    }
  }

  private async computeOpportunities(
    tenantId: string,
    options: {
      limit: number
    }
  ) {
    const assets = await this.assetQuery(tenantId)
      .preload('debtor')
      .preload('events', (query) => query.orderBy('event_date', 'desc').limit(50))
      .preload('cessionOpportunity')
      .orderBy('created_at', 'desc')
      .limit(options.limit)

    return assets.map((asset) => this.projectAsset(asset))
  }

  private assetQuery(tenantId: string) {
    return PrecatorioAsset.query().where('tenant_id', tenantId).whereNull('deleted_at')
  }

  private projectAsset(asset: PrecatorioAsset, pricing?: PricingInput | null) {
    const opportunity = asset.$preloaded.cessionOpportunity as CessionOpportunity | undefined
    const persistedPricing =
      opportunity && !pricing
        ? {
            offerRate: numberOrUndefined(opportunity.offerRate),
            termMonths: opportunity.termMonths,
          }
        : undefined

    return cessionPricingEngine.project(asset, {
      debtor: asset.debtor,
      events: (asset.events ?? []) as AssetEvent[],
      stage: opportunity?.stage ?? 'inbox',
      opportunityId: opportunity?.id ?? null,
      priority: opportunity?.priority ?? 0,
      targetCloseAt: opportunity?.targetCloseAt?.toISO() ?? null,
      lastContactedAt: opportunity?.lastContactedAt?.toISO() ?? null,
      pricing: pricing ?? persistedPricing,
    })
  }

  private writeAuditLog(
    tenantId: string,
    assetId: string,
    opportunity: CessionOpportunity,
    input: PipelineUpdateInput
  ) {
    return db.table('audit_logs').insert({
      tenant_id: tenantId,
      user_id: input.userId ?? null,
      event: 'cession_opportunity_moved',
      entity_type: 'cession_opportunity',
      entity_id: opportunity.id,
      metadata: {
        assetId,
        stage: input.stage,
        grade: opportunity.grade,
        riskAdjustedIrr: opportunity.riskAdjustedIrr,
      },
      request_id: input.requestId ?? null,
    })
  }
}

function matchesFilters(opportunity: OpportunityProjection, filters: OpportunityListFilters) {
  if (filters.grade && opportunity.pricing.grade !== filters.grade) {
    return false
  }

  if (filters.stage && opportunity.pipeline.stage !== filters.stage) {
    return false
  }

  if (
    filters.minRiskAdjustedIrr !== null &&
    filters.minRiskAdjustedIrr !== undefined &&
    opportunity.pricing.riskAdjustedIrr < normalizeRate(filters.minRiskAdjustedIrr)
  ) {
    return false
  }

  if (
    filters.minFaceValue !== null &&
    filters.minFaceValue !== undefined &&
    opportunity.pricing.faceValue < filters.minFaceValue
  ) {
    return false
  }

  if (
    filters.maxFaceValue !== null &&
    filters.maxFaceValue !== undefined &&
    opportunity.pricing.faceValue > filters.maxFaceValue
  ) {
    return false
  }

  if (filters.q) {
    const term = filters.q.toLowerCase()
    const haystack = [
      opportunity.asset.cnjNumber,
      opportunity.asset.assetNumber,
      opportunity.asset.debtorName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(term)
  }

  return true
}

function compareOpportunities(left: OpportunityProjection, right: OpportunityProjection) {
  return (
    right.pricing.finalScore - left.pricing.finalScore ||
    right.pricing.riskAdjustedIrr - left.pricing.riskAdjustedIrr ||
    right.pricing.faceValue - left.pricing.faceValue
  )
}

function scoreDistribution(opportunities: OpportunityProjection[]) {
  const grades: OpportunityGrade[] = ['A+', 'A', 'B+', 'B', 'C', 'D']

  return grades.map((grade) => {
    const items = opportunities.filter((opportunity) => opportunity.pricing.grade === grade)

    return {
      grade,
      count: items.length,
      faceValueTotal: sum(items, (item) => item.pricing.faceValue),
      averageRiskAdjustedIrr: average(items, (item) => item.pricing.riskAdjustedIrr),
    }
  })
}

function summarize(opportunities: OpportunityProjection[]) {
  return {
    count: opportunities.length,
    faceValueTotal: sum(opportunities, (item) => item.pricing.faceValue),
    averageRiskAdjustedIrr: average(opportunities, (item) => item.pricing.riskAdjustedIrr),
    averagePaymentProbability: average(opportunities, (item) => item.pricing.paymentProbability),
  }
}

function sum<T>(items: T[], selector: (item: T) => number) {
  return roundMoney(items.reduce((total, item) => total + selector(item), 0))
}

function average<T>(items: T[], selector: (item: T) => number) {
  if (items.length === 0) {
    return 0
  }

  return Number(
    (items.reduce((total, item) => total + selector(item), 0) / items.length).toFixed(6)
  )
}

function normalizeRate(value: number) {
  return value > 1 ? value / 100 : value
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

function roundMoney(value: number) {
  return Number(value.toFixed(2))
}

function numberOrUndefined(value: string | null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export const operationsService = new OperationsService()
export default operationsService
