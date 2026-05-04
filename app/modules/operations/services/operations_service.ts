import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import CessionOpportunity, {
  type CessionPipelineStage,
  type OpportunityGrade,
} from '#modules/operations/models/cession_opportunity'
import CessionPricing from '#modules/operations/models/cession_pricing'
import CessionStageHistory from '#modules/operations/models/cession_stage_history'
import cessionPricingEngine, {
  type MarketRatePricingSnapshot,
  type OpportunityDataQuality,
  type OpportunityProjection,
  type PricingInput,
} from '#modules/operations/services/cession_pricing_engine'
import assetIntelligenceDossierService from '#modules/operations/services/asset_intelligence_dossier_service'
import liquidityAdvisoryService from '#modules/operations/services/liquidity_advisory_service'
import liquidityDossierService from '#modules/operations/services/liquidity_dossier_service'
import marketRateService from '#modules/market/services/market_rate_service'
import nationalDataCoherenceService, {
  type NationalDataCoherenceGap,
  type NationalDataCoherenceReport,
} from '#modules/integrations/services/national_data_coherence_service'
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
  source?: string | null
  dataIssue?: OpportunityDataIssue | null
  minRiskAdjustedIrr?: number | null
  minFaceValue?: number | null
  maxFaceValue?: number | null
}

export type OpportunityDataIssue =
  | 'missing_value'
  | 'missing_datajud'
  | 'missing_djen'
  | 'missing_field_evidence'
  | 'conflicts'
  | 'candidate_review'

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
    const [marketRates, dataCoherence] = await Promise.all([
      marketRateService.latestSnapshot(),
      nationalDataCoherenceService.build(tenantId),
    ])
    const opportunities = await this.computeOpportunities(tenantId, { limit: 500, marketRates })
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
        rates: marketRates,
      },
      dataOps: buildDataOpsDesk(dataCoherence),
    }
  }

  async list(tenantId: string, filters: OpportunityListFilters) {
    const marketRates = await marketRateService.latestSnapshot()
    const computed = await this.computeOpportunities(tenantId, { limit: 1_000, marketRates })
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
      qualitySummary: summarizeDataQuality(filtered),
      filters,
    }
  }

  async show(tenantId: string, assetId: string, pricing?: PricingInput | null) {
    const marketRates = await marketRateService.latestSnapshot()
    const asset = await this.assetQuery(tenantId)
      .where('id', assetId)
      .preload('debtor', (query) =>
        query.preload('paymentStats', (statsQuery) =>
          statsQuery.orderBy('computed_at', 'desc').limit(1)
        )
      )
      .preload('events', (query) => query.orderBy('event_date', 'desc').limit(100))
      .preload('valuations', (query) => query.orderBy('computed_at', 'desc').limit(1))
      .preload('cessionOpportunity', (query) => query.preload('currentPricing'))
      .preload('judicialProcesses', (query) => query.orderBy('created_at', 'desc').limit(10))
      .preload('publications', (query) => query.orderBy('publication_date', 'desc').limit(10))
      .firstOrFail()

    const opportunity = this.projectAsset(asset, pricing, marketRates)

    return {
      opportunity,
      liquidity: liquidityAdvisoryService.evaluate(opportunity),
      judicialProcesses: asset.judicialProcesses.map((process) => process.serialize()),
      publications: asset.publications.map((publication) => publication.serialize()),
      events: asset.events.map((event) => event.serialize()),
    }
  }

  async dossier(tenantId: string, assetId: string) {
    const details = await this.show(tenantId, assetId)
    const intelligence = await assetIntelligenceDossierService.build(tenantId, assetId)

    return {
      dossier: liquidityDossierService.build({
        opportunity: details.opportunity,
        liquidity: details.liquidity,
      }),
      intelligence,
    }
  }

  async pipeline(tenantId: string) {
    const marketRates = await marketRateService.latestSnapshot()
    const opportunities = await this.computeOpportunities(tenantId, { limit: 1_000, marketRates })
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
      grade: pricing.grade,
      priority: input.priority ?? existing?.priority ?? gradePriority(pricing.grade),
      targetCloseAt: input.targetCloseAt ?? existing?.targetCloseAt ?? null,
      lastContactedAt: input.lastContactedAt ?? existing?.lastContactedAt ?? null,
      notes: input.notes ?? existing?.notes ?? null,
      updatedByUserId: input.userId ?? null,
    }
    const opportunity = existing ?? new CessionOpportunity()

    opportunity.merge({
      ...payload,
      createdByUserId: existing?.createdByUserId ?? input.userId ?? null,
    })
    await opportunity.save()
    const currentPricing = await CessionPricing.create({
      tenantId,
      opportunityId: opportunity.id,
      offerRate: String(pricing.offerRate),
      offerValue: String(pricing.acquisitionCost),
      termMonths: pricing.termMonths,
      expectedAnnualIrr: String(pricing.expectedAnnualIrr),
      riskAdjustedIrr: String(pricing.riskAdjustedIrr),
      paymentProbability: String(pricing.paymentProbability),
      finalScore: String(pricing.finalScore),
      modelVersion: pricing.assumptions.version,
      pricingSnapshot: pricing,
      createdByUserId: input.userId ?? null,
    })
    opportunity.currentPricingId = currentPricing.id
    await opportunity.save()
    await CessionStageHistory.create({
      tenantId,
      opportunityId: opportunity.id,
      fromStage: existing?.stage ?? null,
      toStage: input.stage,
      changedByUserId: input.userId ?? null,
      reason: input.notes ?? null,
    })
    await this.writeAuditLog(tenantId, assetId, opportunity, input, pricing.riskAdjustedIrr)

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
      marketRates: MarketRatePricingSnapshot
    }
  ) {
    const assets = await this.assetQuery(tenantId)
      .preload('debtor', (query) =>
        query.preload('paymentStats', (statsQuery) =>
          statsQuery.orderBy('computed_at', 'desc').limit(1)
        )
      )
      .preload('events', (query) => query.orderBy('event_date', 'desc').limit(50))
      .preload('valuations', (query) => query.orderBy('computed_at', 'desc').limit(1))
      .preload('cessionOpportunity', (query) => query.preload('currentPricing'))
      .orderBy('created_at', 'desc')
      .limit(options.limit)

    const opportunities = assets.map((asset) => this.projectAsset(asset, null, options.marketRates))

    await enrichDataQuality(tenantId, opportunities)

    return opportunities
  }

  private assetQuery(tenantId: string) {
    return PrecatorioAsset.query().where('tenant_id', tenantId).whereNull('deleted_at')
  }

  private projectAsset(
    asset: PrecatorioAsset,
    pricing?: PricingInput | null,
    marketRates?: MarketRatePricingSnapshot | null
  ) {
    const opportunity = asset.$preloaded.cessionOpportunity as CessionOpportunity | undefined
    const currentPricing = opportunity?.$preloaded.currentPricing as CessionPricing | undefined
    const persistedPricing =
      opportunity && !pricing
        ? {
            offerRate: numberOrUndefined(currentPricing?.offerRate ?? null),
            termMonths: currentPricing?.termMonths,
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
      marketRates,
    })
  }

  private writeAuditLog(
    tenantId: string,
    assetId: string,
    opportunity: CessionOpportunity,
    input: PipelineUpdateInput,
    riskAdjustedIrr: number
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
        riskAdjustedIrr,
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

  if (filters.source && opportunity.asset.source !== filters.source) {
    return false
  }

  if (filters.dataIssue && !matchesDataIssue(opportunity, filters.dataIssue)) {
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

function matchesDataIssue(opportunity: OpportunityProjection, issue: OpportunityDataIssue) {
  const quality = opportunity.asset.dataQuality

  switch (issue) {
    case 'missing_value':
      return opportunity.asset.faceValue <= 0 || !quality.hasValuation
    case 'missing_datajud':
      return !quality.hasDataJudProcess
    case 'missing_djen':
      return !quality.hasDjenPublication
    case 'missing_field_evidence':
      return quality.resolvedCoreFields < 4
    case 'conflicts':
      return quality.sourceConflicts > 0 || quality.fieldEvidenceConflicts > 0
    case 'candidate_review':
      return quality.pendingCandidateReviews > 0
  }
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

function buildDataOpsDesk(report: NationalDataCoherenceReport) {
  return {
    generatedAt: report.generatedAt,
    summary: report.summary,
    coverage: [
      {
        key: 'primary_source',
        label: 'Primary source',
        value: report.summary.primarySourceCoverage,
        affected: Math.max(0, report.summary.totalAssets - report.summary.completeAssets),
      },
      {
        key: 'datajud_process',
        label: 'DataJud process',
        value: report.summary.dataJudProcessCoverage,
        affected: missingFromCoverage(
          report.summary.totalAssets,
          report.summary.dataJudProcessCoverage
        ),
      },
      {
        key: 'djen_publication',
        label: 'DJEN publication',
        value: report.summary.djenPublicationCoverage,
        affected: missingFromCoverage(
          report.summary.totalAssets,
          report.summary.djenPublicationCoverage
        ),
      },
      {
        key: 'valuation',
        label: 'Valuation',
        value: report.summary.valuationCoverage,
        affected: missingFromCoverage(report.summary.totalAssets, report.summary.valuationCoverage),
      },
      {
        key: 'score',
        label: 'Scoring',
        value: report.summary.scoreCoverage,
        affected: missingFromCoverage(report.summary.totalAssets, report.summary.scoreCoverage),
      },
      {
        key: 'field_evidence',
        label: 'Field evidence',
        value: report.summary.fieldEvidenceResolvedCoverage,
        affected: missingFromCoverage(
          report.summary.totalAssets,
          report.summary.fieldEvidenceResolvedCoverage
        ),
      },
    ],
    queues: aggregateGaps(report.gaps).slice(0, 8),
    criticalCourts: report.courts
      .filter((court) => court.totalAssets > 0 && court.status !== 'complete')
      .slice(0, 8)
      .map((court) => ({
        courtAlias: court.courtAlias,
        stateCode: court.stateCode,
        status: court.status,
        totalAssets: court.totalAssets,
        completeRate: court.completeRate,
        completeAssets: court.completeAssets,
        missing: court.missing,
        recommendedActions: court.recommendedActions,
      })),
  }
}

function aggregateGaps(gaps: NationalDataCoherenceGap[]) {
  const byCode = new Map<
    string,
    {
      code: string
      label: string
      severity: NationalDataCoherenceGap['severity']
      affected: number
      courts: string[]
      recommendedAction: string
    }
  >()

  for (const gap of gaps) {
    const current = byCode.get(gap.code)
    const next = current ?? {
      code: gap.code,
      label: dataGapLabel(gap.code),
      severity: gap.severity,
      affected: 0,
      courts: [],
      recommendedAction: gap.recommendedAction,
    }

    next.affected += gap.missingCount

    if (!next.courts.includes(gap.courtAlias)) {
      next.courts.push(gap.courtAlias)
    }

    next.severity =
      gapSeverityRank(gap.severity) > gapSeverityRank(next.severity) ? gap.severity : next.severity

    byCode.set(gap.code, next)
  }

  return [...byCode.values()].sort(
    (left, right) =>
      gapSeverityRank(right.severity) - gapSeverityRank(left.severity) ||
      right.affected - left.affected ||
      left.code.localeCompare(right.code)
  )
}

function dataGapLabel(code: string) {
  const labels: Record<string, string> = {
    no_assets: 'No canonical assets',
    missing_primary_source: 'Missing primary source',
    missing_datajud_process: 'Missing DataJud process',
    missing_djen_publication: 'Missing DJEN publication',
    missing_valuation: 'Missing valuation',
    missing_score: 'Missing score',
    missing_field_evidence: 'Missing field evidence',
    source_conflicts: 'Source link conflicts',
    field_evidence_conflicts: 'Field evidence conflicts',
    pending_candidate_review: 'Pending candidate review',
  }

  return labels[code] ?? code
}

function gapSeverityRank(severity: NationalDataCoherenceGap['severity']) {
  return severity === 'high' ? 3 : severity === 'medium' ? 2 : 1
}

function missingFromCoverage(total: number, coverage: number) {
  return Math.max(0, Math.round(total * (1 - coverage)))
}

function summarize(opportunities: OpportunityProjection[]) {
  return {
    count: opportunities.length,
    faceValueTotal: sum(opportunities, (item) => item.pricing.faceValue),
    averageRiskAdjustedIrr: average(opportunities, (item) => item.pricing.riskAdjustedIrr),
    averagePaymentProbability: average(opportunities, (item) => item.pricing.paymentProbability),
  }
}

function summarizeDataQuality(opportunities: OpportunityProjection[]) {
  return {
    total: opportunities.length,
    missingValue: opportunities.filter((item) => matchesDataIssue(item, 'missing_value')).length,
    missingDataJud: opportunities.filter((item) => matchesDataIssue(item, 'missing_datajud'))
      .length,
    missingDjen: opportunities.filter((item) => matchesDataIssue(item, 'missing_djen')).length,
    missingFieldEvidence: opportunities.filter((item) =>
      matchesDataIssue(item, 'missing_field_evidence')
    ).length,
    conflicts: opportunities.filter((item) => matchesDataIssue(item, 'conflicts')).length,
    candidateReview: opportunities.filter((item) => matchesDataIssue(item, 'candidate_review'))
      .length,
    blocked: opportunities.filter((item) => item.asset.dataQuality.status === 'blocked').length,
    complete: opportunities.filter((item) => item.asset.dataQuality.status === 'complete').length,
  }
}

async function enrichDataQuality(tenantId: string, opportunities: OpportunityProjection[]) {
  if (opportunities.length === 0) {
    return
  }

  const ids = opportunities.map((opportunity) => opportunity.asset.id)
  const result = await db.rawQuery(
    `
      select
        precatorio_assets.id,
        exists (
          select 1
          from asset_valuations
          where asset_valuations.tenant_id = precatorio_assets.tenant_id
            and asset_valuations.asset_id = precatorio_assets.id
        ) as has_valuation,
        exists (
          select 1
          from judicial_processes
          where judicial_processes.tenant_id = precatorio_assets.tenant_id
            and judicial_processes.asset_id = precatorio_assets.id
            and judicial_processes.deleted_at is null
            and judicial_processes.source = 'datajud'
        ) as has_datajud_process,
        exists (
          select 1
          from publications
          where publications.tenant_id = precatorio_assets.tenant_id
            and publications.source = 'djen'
            and (
              publications.asset_id = precatorio_assets.id
              or exists (
                select 1
                from judicial_processes
                where judicial_processes.tenant_id = precatorio_assets.tenant_id
                  and judicial_processes.id = publications.process_id
                  and judicial_processes.asset_id = precatorio_assets.id
                  and judicial_processes.deleted_at is null
              )
            )
        ) as has_djen_publication,
        (
          select count(distinct asset_field_evidences.field_key)
          from asset_field_evidences
          where asset_field_evidences.tenant_id = precatorio_assets.tenant_id
            and asset_field_evidences.asset_id = precatorio_assets.id
            and asset_field_evidences.status = 'resolved'
            and asset_field_evidences.field_key in ('cnj_number', 'debtor_name', 'court_alias', 'face_value')
        ) as resolved_core_fields,
        (
          select count(*)
          from asset_field_evidences
          where asset_field_evidences.tenant_id = precatorio_assets.tenant_id
            and asset_field_evidences.asset_id = precatorio_assets.id
            and asset_field_evidences.status = 'conflict'
        ) as field_evidence_conflicts,
        (
          select count(*)
          from asset_source_links
          where asset_source_links.tenant_id = precatorio_assets.tenant_id
            and asset_source_links.asset_id = precatorio_assets.id
            and asset_source_links.link_type = 'conflict'
        ) as source_conflicts,
        (
          select count(*)
          from process_match_candidates
          where process_match_candidates.tenant_id = precatorio_assets.tenant_id
            and process_match_candidates.asset_id = precatorio_assets.id
            and process_match_candidates.status in ('candidate', 'ambiguous')
        ) as pending_candidate_reviews
      from precatorio_assets
      where precatorio_assets.tenant_id = ?
        and precatorio_assets.id = any(?::uuid[])
    `,
    [tenantId, ids]
  )
  const byId = new Map<string, Record<string, unknown>>(
    result.rows.map((row: Record<string, unknown>) => [String(row.id), row])
  )

  for (const opportunity of opportunities) {
    opportunity.asset.dataQuality = buildOpportunityDataQuality(
      opportunity,
      byId.get(opportunity.asset.id)
    )
  }
}

function buildOpportunityDataQuality(
  opportunity: OpportunityProjection,
  row: Record<string, unknown> | undefined
): OpportunityDataQuality {
  const hasValuation = booleanFrom(row?.has_valuation)
  const hasDataJudProcess = booleanFrom(row?.has_datajud_process)
  const hasDjenPublication = booleanFrom(row?.has_djen_publication)
  const resolvedCoreFields = numberFrom(row?.resolved_core_fields)
  const fieldEvidenceConflicts = numberFrom(row?.field_evidence_conflicts)
  const sourceConflicts = numberFrom(row?.source_conflicts)
  const pendingCandidateReviews = numberFrom(row?.pending_candidate_reviews)
  const issues: string[] = []

  if (opportunity.asset.faceValue <= 0 || !hasValuation) issues.push('missing_value')
  if (!hasDataJudProcess) issues.push('missing_datajud')
  if (!hasDjenPublication) issues.push('missing_djen')
  if (resolvedCoreFields < 4) issues.push('missing_field_evidence')
  if (sourceConflicts > 0 || fieldEvidenceConflicts > 0) issues.push('conflicts')
  if (pendingCandidateReviews > 0) issues.push('candidate_review')

  const hasBlocker =
    sourceConflicts > 0 || fieldEvidenceConflicts > 0 || pendingCandidateReviews > 0

  return {
    status: hasBlocker ? 'blocked' : issues.length === 0 ? 'complete' : 'review',
    issues,
    hasValuation,
    hasDataJudProcess,
    hasDjenPublication,
    resolvedCoreFields,
    fieldEvidenceConflicts,
    sourceConflicts,
    pendingCandidateReviews,
  }
}

function booleanFrom(value: unknown) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function numberFrom(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
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
