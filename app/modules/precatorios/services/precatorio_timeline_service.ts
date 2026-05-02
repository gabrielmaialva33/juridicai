import ProcessMatchCandidate from '#modules/integrations/models/process_match_candidate'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'

class PrecatorioTimelineService {
  async build(tenantId: string, assetId: string) {
    const asset = await PrecatorioAsset.query()
      .where('tenant_id', tenantId)
      .where('id', assetId)
      .whereNull('deleted_at')
      .preload('debtor')
      .preload('court')
      .preload('budgetUnit')
      .preload('sourceRecord')
      .preload('sourceLinks', (query) =>
        query
          .preload('sourceRecord')
          .preload('sourceDataset')
          .orderBy('last_seen_at', 'desc')
          .limit(50)
      )
      .preload('externalIdentifiers', (query) =>
        query
          .preload('sourceRecord')
          .preload('sourceDataset')
          .orderBy('is_primary', 'desc')
          .orderBy('identifier_type', 'asc')
      )
      .preload('valuations', (query) => query.orderBy('computed_at', 'desc').limit(20))
      .preload('budgetFacts', (query) => query.orderBy('created_at', 'desc').limit(20))
      .preload('events', (query) => query.orderBy('event_date', 'desc').limit(100))
      .preload('scores', (query) => query.orderBy('computed_at', 'desc').limit(20))
      .preload('judicialProcesses', (query) =>
        query
          .preload('sourceRecord')
          .preload('court')
          .preload('judicialClass')
          .preload('judgingBody')
          .preload('subjects')
          .preload('signals', (signalQuery) => signalQuery.orderBy('detected_at', 'desc').limit(50))
          .preload('movements', (movementQuery) =>
            movementQuery.orderBy('occurred_at', 'desc').limit(50)
          )
          .orderBy('created_at', 'desc')
          .limit(20)
      )
      .preload('publications', (query) =>
        query
          .preload('sourceRecord')
          .preload('events', (eventQuery) => eventQuery.orderBy('event_date', 'desc').limit(20))
          .orderBy('publication_date', 'desc')
          .limit(50)
      )
      .preload('cessionOpportunity', (query) => query.preload('currentPricing'))
      .firstOrFail()
    const processMatchCandidates = await ProcessMatchCandidate.query()
      .where('tenant_id', tenantId)
      .where('asset_id', assetId)
      .orderBy('score', 'desc')
      .orderBy('created_at', 'desc')
      .limit(50)

    return {
      asset: asset.serialize(),
      intelligence: buildIntelligenceSummary(asset, processMatchCandidates),
      provenance: {
        primarySourceRecord: asset.sourceRecord?.serialize() ?? null,
        sourceLinks: asset.sourceLinks.map((link) => link.serialize()),
        externalIdentifiers: asset.externalIdentifiers.map((identifier) => identifier.serialize()),
      },
      processIntelligence: {
        judicialProcesses: asset.judicialProcesses.map((process) => process.serialize()),
        processMatchCandidates: processMatchCandidates.map((candidate) => candidate.serialize()),
      },
      legalSignals: {
        assetEvents: asset.events.map((event) => event.serialize()),
        publications: asset.publications.map((publication) => publication.serialize()),
        scores: asset.scores.map((score) => score.serialize()),
      },
      financialFacts: {
        valuations: asset.valuations.map((valuation) => valuation.serialize()),
        budgetFacts: asset.budgetFacts.map((fact) => fact.serialize()),
        opportunity: asset.cessionOpportunity?.serialize() ?? null,
      },
    }
  }
}

function buildIntelligenceSummary(
  asset: PrecatorioAsset,
  processMatchCandidates: ProcessMatchCandidate[]
) {
  const latestValuation = asset.valuations[0] ?? null
  const latestScore = asset.scores[0] ?? null
  const bestCandidate = processMatchCandidates[0] ?? null
  const signals = asset.judicialProcesses.flatMap((process) => process.signals)
  const publicationEvents = asset.publications.flatMap((publication) => publication.events)
  const negativeSignals = signals.filter((signal) => signal.polarity === 'negative')
  const positiveSignals = signals.filter((signal) => signal.polarity === 'positive')
  const sourceSummary = summarizeSources(asset)
  const missing = missingEvidence(asset, processMatchCandidates)
  const riskFlags = [
    ...negativeSignals.map((signal) => ({
      code: signal.signalCode,
      source: signal.source,
      confidence: signal.confidence,
      detectedAt: signal.detectedAt.toISO(),
    })),
    ...asset.events
      .filter((event) => riskEventTypes.has(event.eventType))
      .map((event) => ({
        code: event.eventType,
        source: event.source,
        confidence: 1,
        detectedAt: event.eventDate.toISO(),
      })),
  ]
  const opportunityFlags = [
    ...positiveSignals.map((signal) => ({
      code: signal.signalCode,
      source: signal.source,
      confidence: signal.confidence,
      detectedAt: signal.detectedAt.toISO(),
    })),
    ...publicationEvents
      .filter((event) => opportunityEventTypes.has(event.eventType))
      .map((event) => ({
        code: event.eventType,
        source: 'djen',
        confidence: 1,
        detectedAt: event.eventDate.toISO(),
      })),
  ]

  return {
    completenessScore: completenessScore(asset, processMatchCandidates),
    sourceSummary,
    evidenceGaps: missing,
    nextBestActions: nextBestActions(asset, processMatchCandidates, missing),
    riskFlags,
    opportunityFlags,
    latestFinancialSnapshot: latestValuation
      ? {
          faceValue: latestValuation.faceValue,
          estimatedUpdatedValue: latestValuation.estimatedUpdatedValue,
          baseDate: latestValuation.baseDate?.toISODate() ?? null,
          queuePosition: latestValuation.queuePosition,
          computedAt: latestValuation.computedAt.toISO(),
        }
      : null,
    latestScore: latestScore
      ? {
          finalScore: latestScore.finalScore,
          dataQualityScore: latestScore.dataQualityScore,
          maturityScore: latestScore.maturityScore,
          liquidityScore: latestScore.liquidityScore,
          legalSignalScore: latestScore.legalSignalScore,
          economicScore: latestScore.economicScore,
          riskScore: latestScore.riskScore,
          computedAt: latestScore.computedAt.toISO(),
        }
      : null,
    bestProcessCandidate: bestCandidate
      ? {
          id: bestCandidate.id,
          score: bestCandidate.score,
          status: bestCandidate.status,
          candidateCnj: bestCandidate.candidateCnj,
          courtAlias: bestCandidate.courtAlias,
        }
      : null,
    counts: {
      sourceLinks: asset.sourceLinks.length,
      externalIdentifiers: asset.externalIdentifiers.length,
      judicialProcesses: asset.judicialProcesses.length,
      processCandidates: processMatchCandidates.length,
      publications: asset.publications.length,
      publicationEvents: publicationEvents.length,
      assetEvents: asset.events.length,
      valuations: asset.valuations.length,
      budgetFacts: asset.budgetFacts.length,
      scores: asset.scores.length,
      positiveSignals: positiveSignals.length,
      negativeSignals: negativeSignals.length,
    },
  }
}

function summarizeSources(asset: PrecatorioAsset) {
  const sourceRecords = [
    asset.sourceRecord,
    ...asset.sourceLinks.map((link) => link.sourceRecord),
    ...asset.externalIdentifiers.map((identifier) => identifier.sourceRecord),
    ...asset.judicialProcesses.map((process) => process.sourceRecord),
    ...asset.publications.map((publication) => publication.sourceRecord),
  ].filter(Boolean)
  const providers = new Map<string, number>()

  for (const sourceRecord of sourceRecords) {
    const providerId = String(
      sourceRecord?.rawData?.providerId ?? sourceRecord?.source ?? 'unknown'
    )
    providers.set(providerId, (providers.get(providerId) ?? 0) + 1)
  }

  return {
    primaryProviderId: asset.sourceRecord?.rawData?.providerId ?? null,
    providers: [...providers.entries()]
      .map(([providerId, count]) => ({ providerId, count }))
      .sort((left, right) => right.count - left.count),
  }
}

function missingEvidence(asset: PrecatorioAsset, processMatchCandidates: ProcessMatchCandidate[]) {
  const gaps: string[] = []

  if (!asset.cnjNumber) gaps.push('missing_cnj_number')
  if (!asset.debtorId) gaps.push('missing_debtor')
  if (!asset.courtId) gaps.push('missing_court_catalog')
  if (!asset.valuations.length) gaps.push('missing_valuation_snapshot')
  if (!asset.budgetFacts.length) gaps.push('missing_budget_fact')
  if (!asset.judicialProcesses.length && !processMatchCandidates.length) {
    gaps.push('missing_datajud_process_link')
  }
  if (processMatchCandidates.some((candidate) => candidate.status === 'candidate')) {
    gaps.push('pending_process_candidate_review')
  }
  if (!asset.publications.length) gaps.push('missing_publication_history')
  if (!asset.scores.length) gaps.push('missing_score_history')

  return gaps
}

function nextBestActions(
  asset: PrecatorioAsset,
  processMatchCandidates: ProcessMatchCandidate[],
  gaps: string[]
) {
  const actions: string[] = []

  if (gaps.includes('missing_cnj_number')) actions.push('enrich_asset_from_datajud')
  if (gaps.includes('pending_process_candidate_review')) actions.push('review_datajud_candidates')
  if (!asset.judicialProcesses.length && processMatchCandidates.length) {
    actions.push('promote_best_process_candidate')
  }
  if (gaps.includes('missing_publication_history')) actions.push('sync_djen_publications')
  if (gaps.includes('missing_score_history')) actions.push('recompute_asset_score')
  if (!asset.cessionOpportunity && (asset.scores[0]?.finalScore ?? 0) >= 85) {
    actions.push('create_cession_opportunity')
  }

  return actions
}

function completenessScore(
  asset: PrecatorioAsset,
  processMatchCandidates: ProcessMatchCandidate[]
) {
  const checks = [
    Boolean(asset.sourceRecordId || asset.sourceLinks.length),
    Boolean(asset.cnjNumber),
    Boolean(asset.debtorId),
    Boolean(asset.courtId),
    asset.valuations.length > 0,
    asset.budgetFacts.length > 0,
    asset.judicialProcesses.length > 0 || processMatchCandidates.length > 0,
    asset.publications.length > 0,
    asset.scores.length > 0,
  ]
  const passed = checks.filter(Boolean).length

  return Math.round((passed / checks.length) * 100)
}

const riskEventTypes = new Set([
  'cession_detected',
  'prior_cession_detected',
  'judicial_block_detected',
  'suspension_detected',
  'attachment_detected',
  'regime_special_detected',
])

const opportunityEventTypes = new Set([
  'direct_agreement_opened',
  'payment_available',
  'superpreference_detected',
  'final_judgment_detected',
  'calculation_homologated',
])

export default new PrecatorioTimelineService()
