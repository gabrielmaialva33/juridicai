import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { DATAJUD_ENRICH_ASSETS_QUEUE } from '#modules/integrations/jobs/datajud_enrich_assets_handler'
import { DATAJUD_MATCH_CANDIDATES_QUEUE } from '#modules/integrations/jobs/datajud_match_candidates_handler'
import {
  GOVERNMENT_DATA_SYNC_ORCHESTRATOR_QUEUE,
  type GovernmentDataSyncOrchestratorPayload,
} from '#modules/integrations/jobs/government_data_sync_orchestrator_handler'
import {
  POST_IMPORT_ENRICHMENT_QUEUE,
  type PostImportEnrichmentPayload,
} from '#modules/integrations/jobs/post_import_enrichment_handler'
import assetIntelligenceDossierService from '#modules/operations/services/asset_intelligence_dossier_service'
import postImportOperationalIntakeService from '#modules/operations/services/post_import_operational_intake_service'
import assetSignalScoreService from '#modules/precatorios/services/asset_signal_score_service'
import queueService from '#shared/services/queue_service'
import type { JsonRecord, SourceType } from '#shared/types/model_enums'

type Dossier = Awaited<ReturnType<typeof assetIntelligenceDossierService.build>>
type RecommendedAction = Dossier['nextBestActions'][number]
type ActionStatus = 'planned' | 'queued' | 'completed' | 'manual' | 'skipped'

export type AssetIntelligenceActionInput = {
  actions?: string[] | null
  dryRun?: boolean
  userId?: string | null
  requestId?: string | null
}

export type AssetIntelligenceActionResult = {
  key: string
  priority: RecommendedAction['priority'] | 'low'
  status: ActionStatus
  reason: string
  queueName?: string | null
  jobName?: string | null
  jobId?: string | null
  bullmqJobId?: string | null
  payload?: JsonRecord | null
  output?: JsonRecord | null
}

class AssetIntelligenceActionService {
  async run(tenantId: string, assetId: string, input: AssetIntelligenceActionInput = {}) {
    const dryRun = input.dryRun ?? false
    const dossier = await assetIntelligenceDossierService.build(tenantId, assetId)
    const actions = actionsToRun(dossier, input.actions)
    const results: AssetIntelligenceActionResult[] = []

    for (const action of actions) {
      results.push(await this.runAction(tenantId, assetId, dossier, action, { ...input, dryRun }))
    }

    await this.writeAuditLog(tenantId, assetId, {
      dryRun,
      requestedActions: input.actions ?? null,
      results,
      userId: input.userId ?? null,
      requestId: input.requestId ?? null,
    })

    return {
      assetId,
      generatedAt: DateTime.utc().toISO(),
      dryRun,
      recommendedActions: dossier.nextBestActions,
      results,
    }
  }

  private async runAction(
    tenantId: string,
    assetId: string,
    dossier: Dossier,
    action: RecommendedAction,
    input: Required<Pick<AssetIntelligenceActionInput, 'dryRun'>> &
      Omit<AssetIntelligenceActionInput, 'dryRun'>
  ): Promise<AssetIntelligenceActionResult> {
    switch (action.key) {
      case 'enrich_from_datajud':
        return this.queueDataJudEnrichment(tenantId, assetId, dossier, action, input)
      case 'review_datajud_candidates':
        if (dossier.relationshipMap.processCandidateIds.length === 0) {
          return this.queueDataJudCandidateMatch(tenantId, assetId, dossier, action, input)
        }

        return manualAction(action, {
          route: `/admin/datajud/candidates?assetId=${assetId}`,
          candidateIds: dossier.relationshipMap.processCandidateIds,
        })
      case 'sync_djen_publications':
        return this.queueGovernmentPublicationSync(tenantId, assetId, dossier, action, input)
      case 'recompute_asset_score':
        return this.recomputeScore(tenantId, assetId, action, input)
      case 'create_cession_opportunity':
        return this.createOpportunity(tenantId, assetId, action, input)
      case 'backfill_financial_facts':
        return this.queuePostImportEnrichment(tenantId, assetId, dossier, action, input, false)
      case 'resolve_high_severity_conflicts':
      case 'link_primary_source_evidence':
        return manualAction(action, {
          conflictKeys: dossier.conflicts.map((conflict) => conflict.key),
          sourceRecordIds: dossier.relationshipMap.sourceRecordIds,
        })
      default:
        return skippedAction(action, 'Unsupported intelligence action.')
    }
  }

  private async queueDataJudEnrichment(
    tenantId: string,
    assetId: string,
    dossier: Dossier,
    action: RecommendedAction,
    input: AssetIntelligenceActionInput & { dryRun: boolean }
  ) {
    return this.queueAction({
      tenantId,
      assetId,
      action,
      dryRun: input.dryRun,
      queueName: DATAJUD_ENRICH_ASSETS_QUEUE,
      jobName: 'datajud-enrich-assets',
      requestId: input.requestId,
      payload: {
        tenantId,
        assetIds: [assetId],
        sourceRecordId: dossier.relationshipMap.primarySourceRecordId,
        source: dossier.canonicalIdentity.source as SourceType,
        missingOnly: true,
        limit: 1,
        requestId: input.requestId ?? null,
        origin: 'http',
      },
    })
  }

  private async queueDataJudCandidateMatch(
    tenantId: string,
    assetId: string,
    dossier: Dossier,
    action: RecommendedAction,
    input: AssetIntelligenceActionInput & { dryRun: boolean }
  ) {
    return this.queueAction({
      tenantId,
      assetId,
      action,
      dryRun: input.dryRun,
      queueName: DATAJUD_MATCH_CANDIDATES_QUEUE,
      jobName: 'datajud-match-candidates',
      requestId: input.requestId,
      payload: {
        tenantId,
        assetIds: [assetId],
        sourceRecordId: dossier.relationshipMap.primarySourceRecordId,
        source: dossier.canonicalIdentity.source as SourceType,
        limit: 1,
        candidatesPerAsset: 5,
        persist: true,
        requestId: input.requestId ?? null,
        origin: 'http',
      },
    })
  }

  private async queueGovernmentPublicationSync(
    tenantId: string,
    assetId: string,
    dossier: Dossier,
    action: RecommendedAction,
    input: AssetIntelligenceActionInput & { dryRun: boolean }
  ) {
    const now = DateTime.utc()
    const courtAlias = courtAliasFrom(dossier)
    const payload: GovernmentDataSyncOrchestratorPayload = {
      tenantId,
      years: uniqueNumbers([now.year, now.plus({ years: 1 }).year]),
      dataJudCourtAliases: courtAlias ? [courtAlias] : null,
      djenCourtAliases: courtAlias ? [courtAlias] : null,
      djenSearchTexts: ['precatório', 'RPV'],
      djenStartDate: now.minus({ days: 30 }).toISODate(),
      djenEndDate: now.toISODate(),
      djenMaxPagesPerCourt: 2,
      dataJudPageSize: 100,
      dataJudMaxPagesPerCourt: 1,
      enrichLimit: 10,
      linkLimit: 50,
      signalLimit: 100,
      publicationLimit: 100,
      matchLimit: 20,
      candidatesPerAsset: 3,
      source: dossier.canonicalIdentity.source as SourceType,
      requestId: input.requestId ?? null,
      origin: 'http',
    }

    return this.queueAction({
      tenantId,
      assetId,
      action,
      dryRun: input.dryRun,
      queueName: GOVERNMENT_DATA_SYNC_ORCHESTRATOR_QUEUE,
      jobName: 'government-data-sync-orchestrator',
      requestId: input.requestId,
      payload,
    })
  }

  private async queuePostImportEnrichment(
    tenantId: string,
    assetId: string,
    dossier: Dossier,
    action: RecommendedAction,
    input: AssetIntelligenceActionInput & { dryRun: boolean },
    createOpportunities: boolean
  ) {
    const payload: PostImportEnrichmentPayload = {
      tenantId,
      assetIds: [assetId],
      sourceRecordId: dossier.relationshipMap.primarySourceRecordId,
      source: dossier.canonicalIdentity.source as SourceType,
      enrichmentLimit: 1,
      linkLimit: 10,
      signalLimit: 25,
      publicationLimit: 25,
      matchLimit: 1,
      candidatesPerAsset: 3,
      operationalLimit: 1,
      createOpportunities,
      requestId: input.requestId ?? null,
      origin: 'http',
    }

    return this.queueAction({
      tenantId,
      assetId,
      action,
      dryRun: input.dryRun,
      queueName: POST_IMPORT_ENRICHMENT_QUEUE,
      jobName: 'post-import-enrichment',
      requestId: input.requestId,
      payload,
    })
  }

  private async recomputeScore(
    tenantId: string,
    assetId: string,
    action: RecommendedAction,
    input: AssetIntelligenceActionInput & { dryRun: boolean }
  ): Promise<AssetIntelligenceActionResult> {
    if (input.dryRun) {
      return plannedAction(action, { assetId })
    }

    const result = await assetSignalScoreService.refresh(tenantId, assetId)

    return {
      key: action.key,
      priority: action.priority,
      status: 'completed',
      reason: action.reason,
      output: {
        scoreId: result.score.id,
        finalScore: result.score.finalScore,
        created: result.created,
      },
    }
  }

  private async createOpportunity(
    tenantId: string,
    assetId: string,
    action: RecommendedAction,
    input: AssetIntelligenceActionInput & { dryRun: boolean }
  ): Promise<AssetIntelligenceActionResult> {
    if (input.dryRun) {
      return plannedAction(action, { assetId, stage: 'inbox' })
    }

    const result = await postImportOperationalIntakeService.run({
      tenantId,
      assetIds: [assetId],
      limit: 1,
      minGrade: 'D',
      minRiskAdjustedIrr: 0,
      createOpportunities: true,
    })

    return {
      key: action.key,
      priority: action.priority,
      status: 'completed',
      reason: action.reason,
      output: result as unknown as JsonRecord,
    }
  }

  private async queueAction(input: {
    tenantId: string
    assetId: string
    action: RecommendedAction
    dryRun: boolean
    queueName: string
    jobName: string
    requestId?: string | null
    payload: JsonRecord
  }): Promise<AssetIntelligenceActionResult> {
    const jobId = actionJobId(input.tenantId, input.assetId, input.action.key)

    if (input.dryRun) {
      return plannedAction(input.action, {
        queueName: input.queueName,
        jobName: input.jobName,
        jobId,
        payload: input.payload,
      })
    }

    const job = await queueService.add(input.queueName, input.jobName, input.payload, {
      jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    })

    return {
      key: input.action.key,
      priority: input.action.priority,
      status: 'queued',
      reason: input.action.reason,
      queueName: input.queueName,
      jobName: input.jobName,
      jobId,
      bullmqJobId: job.id ? String(job.id) : null,
      payload: input.payload,
    }
  }

  private writeAuditLog(
    tenantId: string,
    assetId: string,
    input: {
      dryRun: boolean
      requestedActions: string[] | null
      results: AssetIntelligenceActionResult[]
      userId: string | null
      requestId: string | null
    }
  ) {
    return db.table('audit_logs').insert({
      tenant_id: tenantId,
      user_id: input.userId,
      event: input.dryRun
        ? 'asset_intelligence_actions_planned'
        : 'asset_intelligence_actions_executed',
      entity_type: 'precatorio_asset',
      entity_id: assetId,
      metadata: {
        dryRun: input.dryRun,
        requestedActions: input.requestedActions,
        results: input.results.map((result) => ({
          key: result.key,
          status: result.status,
          queueName: result.queueName ?? null,
          jobId: result.jobId ?? null,
        })),
      },
      request_id: input.requestId,
    })
  }
}

function actionsToRun(dossier: Dossier, requestedActions?: string[] | null): RecommendedAction[] {
  const requested = uniqueStrings(requestedActions ?? [])
  const byKey = new Map(dossier.nextBestActions.map((action) => [action.key, action]))

  if (requested.length === 0) {
    return dossier.nextBestActions
  }

  return requested.map(
    (key) =>
      byKey.get(key) ?? {
        key,
        priority: 'low' as const,
        reason: 'Requested manually.',
      }
  )
}

function plannedAction(
  action: RecommendedAction,
  payload: JsonRecord
): AssetIntelligenceActionResult {
  return {
    key: action.key,
    priority: action.priority,
    status: 'planned',
    reason: action.reason,
    queueName: stringOrNull(payload.queueName),
    jobName: stringOrNull(payload.jobName),
    jobId: stringOrNull(payload.jobId),
    payload,
  }
}

function manualAction(
  action: RecommendedAction,
  output: JsonRecord
): AssetIntelligenceActionResult {
  return {
    key: action.key,
    priority: action.priority,
    status: 'manual',
    reason: action.reason,
    output,
  }
}

function skippedAction(action: RecommendedAction, reason: string): AssetIntelligenceActionResult {
  return {
    key: action.key,
    priority: action.priority,
    status: 'skipped',
    reason,
  }
}

function actionJobId(tenantId: string, assetId: string, actionKey: string) {
  return `asset-intelligence-${tenantId}-${assetId}-${actionKey}-${DateTime.utc().toMillis()}`
}

function courtAliasFrom(dossier: Dossier) {
  const court = dossier.canonicalIdentity.court
  return (court?.alias ?? court?.code ?? '').trim().toLowerCase() || null
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function uniqueNumbers(values: number[]) {
  return [...new Set(values.filter((value) => Number.isFinite(value)))]
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

export const assetIntelligenceActionService = new AssetIntelligenceActionService()
export default assetIntelligenceActionService
