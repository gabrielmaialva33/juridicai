import { DateTime } from 'luxon'
import ProcessMatchCandidate from '#modules/integrations/models/process_match_candidate'
import type CessionOpportunity from '#modules/operations/models/cession_opportunity'
import type CessionPricing from '#modules/operations/models/cession_pricing'
import type AssetEvent from '#modules/precatorios/models/asset_event'
import type AssetSourceLink from '#modules/precatorios/models/asset_source_link'
import type ExternalIdentifier from '#modules/precatorios/models/external_identifier'
import type JudicialProcess from '#modules/precatorios/models/judicial_process'
import type JudicialProcessSignal from '#modules/precatorios/models/judicial_process_signal'
import type Publication from '#modules/precatorios/models/publication'
import type PublicationEvent from '#modules/precatorios/models/publication_event'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import type SourceRecord from '#modules/siop/models/source_record'
import type { JsonRecord } from '#shared/types/model_enums'

type CompletenessStatus = 'complete' | 'partial' | 'missing'
type ConflictSeverity = 'high' | 'medium' | 'low'

type CompletenessCheck = {
  key: string
  label: string
  status: CompletenessStatus
  weight: number
  evidenceCount: number
  message: string
}

class AssetIntelligenceDossierService {
  async build(tenantId: string, assetId: string) {
    const asset = await this.assetQuery(tenantId, assetId).firstOrFail()
    const processMatchCandidates = await ProcessMatchCandidate.query()
      .where('tenant_id', tenantId)
      .where('asset_id', assetId)
      .orderBy('score', 'desc')
      .orderBy('created_at', 'desc')
      .limit(50)
    const context = buildContext(asset, processMatchCandidates)
    const completeness = buildCompleteness(context)
    const conflicts = detectConflicts(context)
    const confidence = buildConfidence(completeness.score, conflicts, context)

    return {
      generatedAt: DateTime.utc().toISO(),
      canonicalIdentity: buildCanonicalIdentity(context),
      relationshipMap: buildRelationshipMap(context),
      evidenceGraph: buildEvidenceGraph(context),
      completeness,
      confidence,
      conflicts,
      legalSignals: buildLegalSignals(context),
      financialIntelligence: buildFinancialIntelligence(context),
      processIntelligence: buildProcessIntelligence(context),
      operationalIntelligence: buildOperationalIntelligence(context),
      freshness: buildFreshness(context),
      nextBestActions: buildNextBestActions(context, completeness.checks, conflicts),
    }
  }

  private assetQuery(tenantId: string, assetId: string) {
    return PrecatorioAsset.query()
      .where('tenant_id', tenantId)
      .where('id', assetId)
      .whereNull('deleted_at')
      .preload('debtor', (query) =>
        query.preload('paymentStats', (statsQuery) =>
          statsQuery.orderBy('computed_at', 'desc').limit(3)
        )
      )
      .preload('court')
      .preload('budgetUnit')
      .preload('sourceRecord', (query) => query.preload('sourceDataset'))
      .preload('sourceLinks', (query) =>
        query
          .preload('sourceRecord', (sourceQuery) => sourceQuery.preload('sourceDataset'))
          .preload('sourceDataset')
          .orderBy('last_seen_at', 'desc')
          .limit(100)
      )
      .preload('externalIdentifiers', (query) =>
        query
          .preload('sourceRecord', (sourceQuery) => sourceQuery.preload('sourceDataset'))
          .preload('sourceDataset')
          .orderBy('is_primary', 'desc')
          .orderBy('identifier_type', 'asc')
          .limit(100)
      )
      .preload('valuations', (query) => query.orderBy('computed_at', 'desc').limit(30))
      .preload('budgetFacts', (query) => query.orderBy('created_at', 'desc').limit(30))
      .preload('events', (query) => query.orderBy('event_date', 'desc').limit(150))
      .preload('scores', (query) => query.orderBy('computed_at', 'desc').limit(30))
      .preload('judicialProcesses', (query) =>
        query
          .preload('sourceRecord', (sourceQuery) => sourceQuery.preload('sourceDataset'))
          .preload('court')
          .preload('judicialClass')
          .preload('judgingBody')
          .preload('subjects')
          .preload('signals', (signalQuery) => signalQuery.orderBy('detected_at', 'desc').limit(80))
          .preload('movements', (movementQuery) =>
            movementQuery.orderBy('occurred_at', 'desc').limit(80)
          )
          .orderBy('created_at', 'desc')
          .limit(30)
      )
      .preload('publications', (query) =>
        query
          .preload('sourceRecord', (sourceQuery) => sourceQuery.preload('sourceDataset'))
          .preload('events', (eventQuery) => eventQuery.orderBy('event_date', 'desc').limit(50))
          .orderBy('publication_date', 'desc')
          .limit(80)
      )
      .preload('cessionOpportunity', (query) => query.preload('currentPricing'))
  }
}

type IntelligenceContext = ReturnType<typeof buildContext>

function buildContext(asset: PrecatorioAsset, processMatchCandidates: ProcessMatchCandidate[]) {
  const judicialProcesses = (asset.judicialProcesses ?? []) as JudicialProcess[]
  const publications = (asset.publications ?? []) as Publication[]
  const sourceLinks = (asset.sourceLinks ?? []) as AssetSourceLink[]
  const externalIdentifiers = (asset.externalIdentifiers ?? []) as ExternalIdentifier[]
  const events = (asset.events ?? []) as AssetEvent[]
  const processSignals = judicialProcesses.flatMap(
    (process) => (process.signals ?? []) as JudicialProcessSignal[]
  )
  const publicationEvents = publications.flatMap(
    (publication) => (publication.events ?? []) as PublicationEvent[]
  )
  const opportunity = asset.$preloaded.cessionOpportunity as CessionOpportunity | undefined
  const currentPricing = opportunity?.$preloaded.currentPricing as CessionPricing | undefined

  return {
    asset,
    sourceLinks,
    externalIdentifiers,
    judicialProcesses,
    publications,
    events,
    processSignals,
    publicationEvents,
    processMatchCandidates,
    opportunity,
    currentPricing,
  }
}

function buildCanonicalIdentity(context: IntelligenceContext) {
  const { asset } = context
  const identifiers = context.externalIdentifiers.map((identifier) => ({
    type: identifier.identifierType,
    value: identifier.identifierValue,
    normalizedValue: identifier.normalizedValue,
    issuer: identifier.issuer,
    confidence: decimalNumber(identifier.confidence),
    isPrimary: identifier.isPrimary,
    sourceRecordId: identifier.sourceRecordId,
  }))

  return {
    assetId: asset.id,
    source: asset.source,
    externalId: asset.externalId,
    cnjNumber: asset.cnjNumber,
    originProcessNumber: asset.originProcessNumber,
    assetNumber: asset.assetNumber,
    nature: asset.nature,
    lifecycleStatus: asset.lifecycleStatus,
    complianceStatus: asset.complianceStatus,
    piiStatus: asset.piiStatus,
    exerciseYear: asset.exerciseYear,
    budgetYear: asset.budgetYear,
    debtor: asset.debtor
      ? {
          id: asset.debtor.id,
          name: asset.debtor.name,
          normalizedKey: asset.debtor.normalizedKey,
          debtorType: asset.debtor.debtorType,
          stateCode: asset.debtor.stateCode,
          paymentRegime: asset.debtor.paymentRegime,
        }
      : null,
    court: asset.court
      ? {
          id: asset.court.id,
          code: asset.court.code,
          alias: asset.court.alias,
          name: asset.court.name,
          courtClass: asset.court.courtClass,
        }
      : null,
    budgetUnit: asset.budgetUnit
      ? {
          id: asset.budgetUnit.id,
          code: asset.budgetUnit.code,
          name: asset.budgetUnit.name,
        }
      : null,
    identifiers,
  }
}

function buildRelationshipMap(context: IntelligenceContext) {
  return {
    assetId: context.asset.id,
    tenantId: context.asset.tenantId,
    debtorId: context.asset.debtorId,
    courtId: context.asset.courtId,
    budgetUnitId: context.asset.budgetUnitId,
    primarySourceRecordId: context.asset.sourceRecordId,
    sourceRecordIds: unique([
      context.asset.sourceRecordId,
      ...context.sourceLinks.map((link) => link.sourceRecordId),
      ...context.externalIdentifiers.map((identifier) => identifier.sourceRecordId),
      ...context.judicialProcesses.map((process) => process.sourceRecordId),
      ...context.publications.map((publication) => publication.sourceRecordId),
    ]),
    judicialProcessIds: context.judicialProcesses.map((process) => process.id),
    publicationIds: context.publications.map((publication) => publication.id),
    processCandidateIds: context.processMatchCandidates.map((candidate) => candidate.id),
    opportunityId: context.opportunity?.id ?? null,
    currentPricingId: context.currentPricing?.id ?? null,
  }
}

function buildEvidenceGraph(context: IntelligenceContext) {
  const sourceRecords = collectSourceRecords(context)
  const linkTypeCounts = countBy(context.sourceLinks, (link) => link.linkType)
  const sourceCounts = countBy(sourceRecords, (sourceRecord) => sourceRecord.source)
  const datasetCounts = countBy(
    sourceRecords,
    (sourceRecord) =>
      sourceRecord.sourceDataset?.key ??
      String(sourceRecord.rawData?.providerId ?? sourceRecord.source)
  )
  const confidences = context.sourceLinks.map((link) => decimalNumber(link.confidence))

  return {
    sourceRecords: sourceRecords.map((sourceRecord) => ({
      id: sourceRecord.id,
      source: sourceRecord.source,
      datasetKey: sourceRecord.sourceDataset?.key ?? null,
      providerId: sourceRecord.rawData?.providerId ?? null,
      originalFilename: sourceRecord.originalFilename,
      sourceUrl: sourceRecord.sourceUrl,
      checksum: sourceRecord.sourceChecksum,
      collectedAt: sourceRecord.collectedAt.toISO(),
    })),
    sourceCounts,
    datasetCounts,
    linkTypeCounts,
    sourceLinks: context.sourceLinks.map((link) => ({
      id: link.id,
      sourceRecordId: link.sourceRecordId,
      datasetKey: link.sourceDataset?.key ?? link.sourceRecord?.sourceDataset?.key ?? null,
      linkType: link.linkType,
      confidence: decimalNumber(link.confidence),
      matchReason: link.matchReason,
      matchedFields: link.matchedFields,
      normalizedPayload: link.normalizedPayload,
      firstSeenAt: link.firstSeenAt.toISO(),
      lastSeenAt: link.lastSeenAt.toISO(),
    })),
    identifiersByType: groupIdentifiers(context.externalIdentifiers),
    confidence: {
      minimum: confidences.length ? Math.min(...confidences) : null,
      average: confidences.length
        ? round(confidences.reduce((sum, item) => sum + item, 0) / confidences.length)
        : null,
      maximum: confidences.length ? Math.max(...confidences) : null,
    },
  }
}

function buildCompleteness(context: IntelligenceContext) {
  const checks: CompletenessCheck[] = [
    completenessCheck({
      key: 'source_evidence',
      label: 'Source evidence',
      weight: 15,
      count: context.sourceLinks.length + (context.asset.sourceRecordId ? 1 : 0),
      complete: context.sourceLinks.length > 0,
      partial: Boolean(context.asset.sourceRecordId),
      missingMessage: 'No source evidence is linked to this asset.',
    }),
    completenessCheck({
      key: 'canonical_identity',
      label: 'Canonical identity',
      weight: 20,
      count: [context.asset.cnjNumber, context.asset.debtorId, context.asset.courtId].filter(
        Boolean
      ).length,
      complete: Boolean(context.asset.cnjNumber && context.asset.debtorId && context.asset.courtId),
      partial:
        [context.asset.cnjNumber, context.asset.debtorId, context.asset.courtId].filter(Boolean)
          .length >= 2,
      missingMessage: 'CNJ, debtor, or court identity is incomplete.',
    }),
    completenessCheck({
      key: 'judicial_process',
      label: 'Judicial process',
      weight: 15,
      count: context.judicialProcesses.length + context.processMatchCandidates.length,
      complete: context.judicialProcesses.length > 0,
      partial: context.processMatchCandidates.length > 0,
      missingMessage: 'No DataJud process link or candidate was found.',
    }),
    completenessCheck({
      key: 'publication_history',
      label: 'Publication history',
      weight: 10,
      count: context.publications.length + context.publicationEvents.length,
      complete: context.publications.length > 0 && context.publicationEvents.length > 0,
      partial: context.publications.length > 0,
      missingMessage: 'No DJEN publication history is linked.',
    }),
    completenessCheck({
      key: 'financial_facts',
      label: 'Financial facts',
      weight: 15,
      count: context.asset.valuations.length + context.asset.budgetFacts.length,
      complete: context.asset.valuations.length > 0 && context.asset.budgetFacts.length > 0,
      partial: context.asset.valuations.length > 0 || context.asset.budgetFacts.length > 0,
      missingMessage: 'No valuation or budget fact is available.',
    }),
    completenessCheck({
      key: 'legal_signals',
      label: 'Legal signals',
      weight: 10,
      count:
        context.events.length + context.processSignals.length + context.publicationEvents.length,
      complete:
        context.processSignals.length > 0 ||
        context.publicationEvents.length > 0 ||
        context.events.length >= 2,
      partial: context.events.length > 0,
      missingMessage: 'No legal signal was classified yet.',
    }),
    completenessCheck({
      key: 'scoring',
      label: 'Scoring history',
      weight: 10,
      count: context.asset.scores.length + (context.asset.currentScore !== null ? 1 : 0),
      complete: context.asset.scores.length > 0,
      partial: context.asset.currentScore !== null,
      missingMessage: 'No score history is available.',
    }),
    completenessCheck({
      key: 'operation',
      label: 'Operational state',
      weight: 5,
      count: context.opportunity ? 1 : 0,
      complete: Boolean(context.opportunity && context.currentPricing),
      partial: Boolean(context.opportunity),
      missingMessage: 'No cession opportunity or pricing snapshot exists.',
    }),
  ]
  const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0)
  const weighted = checks.reduce((sum, check) => {
    if (check.status === 'complete') return sum + check.weight
    if (check.status === 'partial') return sum + check.weight * 0.5
    return sum
  }, 0)
  const score = Math.round((weighted / totalWeight) * 100)

  return {
    score,
    grade: completenessGrade(score),
    checks,
    missing: checks.filter((check) => check.status === 'missing').map((check) => check.key),
    partial: checks.filter((check) => check.status === 'partial').map((check) => check.key),
  }
}

function detectConflicts(context: IntelligenceContext) {
  const conflicts: Array<{
    key: string
    severity: ConflictSeverity
    message: string
    evidence: JsonRecord
  }> = []
  const normalizedAssetCnj = normalizeIdentifier(context.asset.cnjNumber)
  const normalizedAssetNumber = normalizeIdentifier(context.asset.assetNumber)

  for (const identifier of context.externalIdentifiers) {
    const normalizedValue = normalizeIdentifier(identifier.normalizedValue)

    if (
      identifier.identifierType === 'cnj_number' &&
      normalizedAssetCnj &&
      normalizedValue &&
      normalizedValue !== normalizedAssetCnj
    ) {
      conflicts.push({
        key: 'cnj_identifier_mismatch',
        severity: 'high',
        message: 'External CNJ identifier does not match the canonical asset CNJ.',
        evidence: {
          canonicalCnj: context.asset.cnjNumber,
          identifierValue: identifier.identifierValue,
          sourceRecordId: identifier.sourceRecordId,
        },
      })
    }

    if (
      identifier.identifierType === 'asset_number' &&
      normalizedAssetNumber &&
      normalizedValue &&
      normalizedValue !== normalizedAssetNumber
    ) {
      conflicts.push({
        key: 'asset_number_identifier_mismatch',
        severity: 'medium',
        message: 'External asset number does not match the canonical asset number.',
        evidence: {
          canonicalAssetNumber: context.asset.assetNumber,
          identifierValue: identifier.identifierValue,
          sourceRecordId: identifier.sourceRecordId,
        },
      })
    }
  }

  for (const [identifierType, values] of identifierValuesByType(context.externalIdentifiers)) {
    if (values.size > 1) {
      conflicts.push({
        key: 'multiple_identifier_values',
        severity: identifierType === 'cnj_number' ? 'high' : 'medium',
        message: `Multiple values were found for ${identifierType}.`,
        evidence: {
          identifierType,
          values: [...values],
        },
      })
    }
  }

  for (const process of context.judicialProcesses) {
    if (
      normalizedAssetCnj &&
      normalizeIdentifier(process.cnjNumber) &&
      normalizeIdentifier(process.cnjNumber) !== normalizedAssetCnj
    ) {
      conflicts.push({
        key: 'linked_process_cnj_mismatch',
        severity: 'high',
        message: 'A linked judicial process has a different CNJ number.',
        evidence: {
          processId: process.id,
          assetCnj: context.asset.cnjNumber,
          processCnj: process.cnjNumber,
        },
      })
    }
  }

  for (const link of context.sourceLinks.filter((item) => item.linkType === 'conflict')) {
    conflicts.push({
      key: 'source_conflict_link',
      severity: 'high',
      message: 'A source record is explicitly linked as conflicting evidence.',
      evidence: {
        sourceRecordId: link.sourceRecordId,
        matchReason: link.matchReason,
        matchedFields: link.matchedFields,
      },
    })
  }

  const faceValues = context.asset.valuations
    .map((valuation) => decimalNumber(valuation.faceValue))
    .filter((value) => value > 0)
  if (faceValues.length > 1) {
    const minimum = Math.min(...faceValues)
    const maximum = Math.max(...faceValues)
    if (minimum > 0 && (maximum - minimum) / minimum >= 0.05) {
      conflicts.push({
        key: 'valuation_face_value_divergence',
        severity: 'medium',
        message: 'Valuation snapshots diverge by at least 5%.',
        evidence: {
          minimumFaceValue: minimum,
          maximumFaceValue: maximum,
        },
      })
    }
  }

  return conflicts
}

function buildConfidence(
  completenessScore: number,
  conflicts: ReturnType<typeof detectConflicts>,
  context: IntelligenceContext
) {
  const highConflicts = conflicts.filter((conflict) => conflict.severity === 'high').length
  const mediumConflicts = conflicts.filter((conflict) => conflict.severity === 'medium').length
  const acceptedProcess = context.judicialProcesses.length > 0
  const crossCheckedSources =
    context.sourceLinks.filter((link) => link.linkType === 'cross_check').length > 0
  const score = clamp(
    completenessScore +
      (acceptedProcess ? 8 : 0) +
      (crossCheckedSources ? 5 : 0) -
      highConflicts * 20 -
      mediumConflicts * 10,
    0,
    100
  )

  return {
    score,
    grade: confidenceGrade(score),
    acceptedProcess,
    crossCheckedSources,
    conflictPenalty: highConflicts * 20 + mediumConflicts * 10,
  }
}

function buildLegalSignals(context: IntelligenceContext) {
  const assetEvents = context.events.map((event) => ({
    id: event.id,
    code: event.eventType,
    source: event.source,
    polarity: signalPolarity(event.eventType),
    eventDate: event.eventDate.toISO(),
    payload: event.payload,
  }))
  const processSignals = context.processSignals.map((signal) => ({
    id: signal.id,
    code: signal.signalCode,
    source: signal.source,
    polarity: signal.polarity,
    confidence: signal.confidence,
    detectedAt: signal.detectedAt.toISO(),
  }))
  const publicationEvents = context.publicationEvents.map((event) => ({
    id: event.id,
    code: event.eventType,
    source: 'djen',
    polarity: signalPolarity(event.eventType),
    eventDate: event.eventDate.toISO(),
    publicationId: event.publicationId,
  }))

  return {
    positive: [...assetEvents, ...processSignals, ...publicationEvents].filter(
      (signal) => signal.polarity === 'positive'
    ),
    negative: [...assetEvents, ...processSignals, ...publicationEvents].filter(
      (signal) => signal.polarity === 'negative'
    ),
    neutral: [...assetEvents, ...processSignals, ...publicationEvents].filter(
      (signal) => signal.polarity === 'neutral'
    ),
  }
}

function buildFinancialIntelligence(context: IntelligenceContext) {
  const valuations = context.asset.valuations.map((valuation) => ({
    id: valuation.id,
    faceValue: decimalNumber(valuation.faceValue),
    estimatedUpdatedValue: decimalNumber(valuation.estimatedUpdatedValue),
    baseDate: valuation.baseDate?.toISODate() ?? null,
    correctionStartedAt: valuation.correctionStartedAt?.toISODate() ?? null,
    correctionEndedAt: valuation.correctionEndedAt?.toISODate() ?? null,
    correctionIndex: decimalNumber(valuation.correctionIndex),
    queuePosition: valuation.queuePosition,
    sourceRecordId: valuation.sourceRecordId,
    computedAt: valuation.computedAt.toISO(),
  }))
  const budgetFacts = context.asset.budgetFacts.map((fact) => ({
    id: fact.id,
    exerciseYear: fact.exerciseYear,
    budgetYear: fact.budgetYear,
    budgetUnitId: fact.budgetUnitId,
    expenseType: fact.expenseType,
    causeType: fact.causeType,
    natureExpenseCode: fact.natureExpenseCode,
    valueRange: fact.valueRange,
    taxClaim: fact.taxClaim,
    fundef: fact.fundef,
    sourceRecordId: fact.sourceRecordId,
  }))

  return {
    latestValuation: valuations[0] ?? null,
    valuations,
    budgetFacts,
  }
}

function buildProcessIntelligence(context: IntelligenceContext) {
  return {
    linkedProcesses: context.judicialProcesses.map((process) => ({
      id: process.id,
      cnjNumber: process.cnjNumber,
      source: process.source,
      courtAlias: process.courtAlias,
      court: process.court
        ? {
            code: process.court.code,
            alias: process.court.alias,
            name: process.court.name,
          }
        : null,
      className: process.judicialClass?.name ?? null,
      judgingBodyName: process.judgingBody?.name ?? null,
      filedAt: process.filedAt?.toISODate() ?? null,
      datajudUpdatedAt: process.datajudUpdatedAt?.toISO() ?? null,
      movements: process.movements?.length ?? 0,
      subjects: process.subjects?.length ?? 0,
      signals: process.signals?.length ?? 0,
      sourceRecordId: process.sourceRecordId,
    })),
    candidates: context.processMatchCandidates.map((candidate) => ({
      id: candidate.id,
      status: candidate.status,
      score: candidate.score,
      candidateCnj: candidate.candidateCnj,
      courtAlias: candidate.courtAlias,
      sourceRecordId: candidate.sourceRecordId,
      signals: candidate.signals,
    })),
  }
}

function buildOperationalIntelligence(context: IntelligenceContext) {
  return {
    opportunity: context.opportunity
      ? {
          id: context.opportunity.id,
          stage: context.opportunity.stage,
          grade: context.opportunity.grade,
          priority: context.opportunity.priority,
          targetCloseAt: context.opportunity.targetCloseAt?.toISO() ?? null,
          lastContactedAt: context.opportunity.lastContactedAt?.toISO() ?? null,
          currentPricingId: context.opportunity.currentPricingId,
        }
      : null,
    currentPricing: context.currentPricing
      ? {
          id: context.currentPricing.id,
          offerRate: decimalNumber(context.currentPricing.offerRate),
          offerValue: decimalNumber(context.currentPricing.offerValue),
          termMonths: context.currentPricing.termMonths,
          expectedAnnualIrr: decimalNumber(context.currentPricing.expectedAnnualIrr),
          riskAdjustedIrr: decimalNumber(context.currentPricing.riskAdjustedIrr),
          paymentProbability: decimalNumber(context.currentPricing.paymentProbability),
          finalScore: decimalNumber(context.currentPricing.finalScore),
          modelVersion: context.currentPricing.modelVersion,
          computedAt: context.currentPricing.computedAt.toISO(),
        }
      : null,
  }
}

function buildFreshness(context: IntelligenceContext) {
  const dates = [
    context.asset.createdAt,
    context.asset.updatedAt,
    context.asset.sourceRecord?.collectedAt,
    ...context.sourceLinks.map((link) => link.lastSeenAt),
    ...context.asset.valuations.map((valuation) => valuation.computedAt),
    ...context.events.map((event) => event.eventDate),
    ...context.judicialProcesses.map((process) => process.datajudUpdatedAt ?? process.createdAt),
    ...context.publications.map((publication) => publication.publicationDate),
  ].filter((date): date is DateTime => Boolean(date?.isValid))
  const latest = dates.sort((left, right) => right.toMillis() - left.toMillis())[0] ?? null
  const ageDays = latest ? Math.floor(DateTime.utc().diff(latest, 'days').days) : null

  return {
    latestEvidenceAt: latest?.toISO() ?? null,
    evidenceAgeDays: ageDays,
    stale: ageDays === null ? true : ageDays > 30,
  }
}

function buildNextBestActions(
  context: IntelligenceContext,
  checks: CompletenessCheck[],
  conflicts: ReturnType<typeof detectConflicts>
) {
  const missing = new Set(
    checks.filter((check) => check.status === 'missing').map((check) => check.key)
  )
  const partial = new Set(
    checks.filter((check) => check.status === 'partial').map((check) => check.key)
  )
  const actions: Array<{ key: string; priority: 'high' | 'medium' | 'low'; reason: string }> = []

  if (conflicts.some((conflict) => conflict.severity === 'high')) {
    actions.push({
      key: 'resolve_high_severity_conflicts',
      priority: 'high',
      reason: 'High severity identity or source conflicts are present.',
    })
  }
  if (missing.has('judicial_process') || partial.has('judicial_process')) {
    actions.push({
      key: context.processMatchCandidates.length
        ? 'review_datajud_candidates'
        : 'enrich_from_datajud',
      priority: 'high',
      reason: 'Process linkage is required before strong legal confidence.',
    })
  }
  if (missing.has('publication_history') || partial.has('publication_history')) {
    actions.push({
      key: 'sync_djen_publications',
      priority: 'medium',
      reason: 'DJEN publications are needed to detect fresh liquidity and risk events.',
    })
  }
  if (missing.has('financial_facts') || partial.has('financial_facts')) {
    actions.push({
      key: 'backfill_financial_facts',
      priority: 'medium',
      reason: 'Valuation and budget facts are needed for pricing confidence.',
    })
  }
  if (missing.has('source_evidence') || partial.has('source_evidence')) {
    actions.push({
      key: 'link_primary_source_evidence',
      priority: 'medium',
      reason: 'Every canonical asset should be backed by explicit source evidence.',
    })
  }
  if (missing.has('scoring') || partial.has('scoring')) {
    actions.push({
      key: 'recompute_asset_score',
      priority: 'low',
      reason: 'Score history should reflect the latest evidence graph.',
    })
  }
  if (
    !context.opportunity &&
    context.asset.scores[0]?.finalScore &&
    context.asset.scores[0].finalScore >= 80
  ) {
    actions.push({
      key: 'create_cession_opportunity',
      priority: 'low',
      reason: 'The asset has enough score to be reviewed by operations.',
    })
  }

  return dedupeActions(actions)
}

function completenessCheck(input: {
  key: string
  label: string
  weight: number
  count: number
  complete: boolean
  partial: boolean
  missingMessage: string
}): CompletenessCheck {
  const status = input.complete ? 'complete' : input.partial ? 'partial' : 'missing'

  return {
    key: input.key,
    label: input.label,
    status,
    weight: input.weight,
    evidenceCount: input.count,
    message:
      status === 'complete'
        ? `${input.label} is complete.`
        : status === 'partial'
          ? `${input.label} is partially covered.`
          : input.missingMessage,
  }
}

function collectSourceRecords(context: IntelligenceContext) {
  const records = (
    [
      context.asset.sourceRecord,
      ...context.sourceLinks.map((link) => link.sourceRecord),
      ...context.externalIdentifiers.map((identifier) => identifier.sourceRecord),
      ...context.judicialProcesses.map((process) => process.sourceRecord),
      ...context.publications.map((publication) => publication.sourceRecord),
    ] as unknown[]
  ).filter((record): record is SourceRecord => Boolean(record))
  const byId = new Map(records.map((record) => [record.id, record]))

  return [...byId.values()].sort(
    (left, right) => right.collectedAt.toMillis() - left.collectedAt.toMillis()
  )
}

function groupIdentifiers(identifiers: ExternalIdentifier[]) {
  return [...identifierValuesByType(identifiers)].map(([type, values]) => ({
    type,
    values: [...values],
    count: identifiers.filter((identifier) => identifier.identifierType === type).length,
    primaryValues: identifiers
      .filter((identifier) => identifier.identifierType === type && identifier.isPrimary)
      .map((identifier) => identifier.normalizedValue),
  }))
}

function identifierValuesByType(identifiers: ExternalIdentifier[]) {
  const groups = new Map<string, Set<string>>()

  for (const identifier of identifiers) {
    const normalized = normalizeIdentifier(identifier.normalizedValue)
    if (!normalized) continue

    const values = groups.get(identifier.identifierType) ?? new Set<string>()
    values.add(normalized)
    groups.set(identifier.identifierType, values)
  }

  return groups
}

function countBy<T>(items: T[], selector: (item: T) => string | null | undefined) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = selector(item) ?? 'unknown'
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function decimalNumber(value: string | number | null | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeIdentifier(value: string | null | undefined) {
  return value?.replace(/\D/g, '') || null
}

function signalPolarity(code: string): 'positive' | 'negative' | 'neutral' {
  if (positiveSignalCodes.has(code)) return 'positive'
  if (negativeSignalCodes.has(code)) return 'negative'
  return 'neutral'
}

function completenessGrade(score: number) {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 55) return 'C'
  return 'D'
}

function confidenceGrade(score: number) {
  if (score >= 85) return 'high'
  if (score >= 65) return 'medium'
  return 'low'
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function round(value: number) {
  return Number(value.toFixed(4))
}

function dedupeActions(
  actions: Array<{ key: string; priority: 'high' | 'medium' | 'low'; reason: string }>
) {
  const byKey = new Map(actions.map((action) => [action.key, action]))
  return [...byKey.values()]
}

const positiveSignalCodes = new Set([
  'direct_agreement_opened',
  'payment_available',
  'superpreference_detected',
  'final_judgment_detected',
  'calculation_homologated',
  'requisition_issued',
])

const negativeSignalCodes = new Set([
  'cession_detected',
  'prior_cession_detected',
  'judicial_block_detected',
  'suspension_detected',
  'attachment_detected',
  'regime_special_detected',
])

export default new AssetIntelligenceDossierService()
