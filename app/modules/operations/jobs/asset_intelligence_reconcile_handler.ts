import assetIntelligenceReconcileService from '#modules/operations/services/asset_intelligence_reconcile_service'
import tenantContext from '#shared/helpers/tenant_context'
import jobRunService from '#shared/services/job_run_service'
import type { JobRunOrigin, SourceType } from '#shared/types/model_enums'

export const ASSET_INTELLIGENCE_RECONCILE_QUEUE = 'asset-intelligence-reconcile'

export type AssetIntelligenceReconcilePayload = {
  tenantId: string
  limit?: number | null
  source?: SourceType | null
  dryRun?: boolean
  highPriorityOnly?: boolean
  includeManualActions?: boolean
  allowAutomationWithConflicts?: boolean
  maxActionsPerAsset?: number | null
  recentActionCooldownHours?: number | null
  useNationalCoherence?: boolean | null
  materializeFieldEvidence?: boolean | null
  requestId?: string | null
  bullmqJobId?: string | null
  attempts?: number | null
  origin?: JobRunOrigin
}

export async function handleAssetIntelligenceReconcile(payload: AssetIntelligenceReconcilePayload) {
  const run = await jobRunService.start({
    tenantId: payload.tenantId,
    jobName: 'asset-intelligence-reconcile',
    queueName: ASSET_INTELLIGENCE_RECONCILE_QUEUE,
    bullmqJobId: payload.bullmqJobId ?? null,
    attempts: payload.attempts ?? null,
    origin: payload.origin ?? 'scheduler',
    metadata: {
      requestId: payload.requestId ?? null,
      limit: payload.limit ?? null,
      source: payload.source ?? null,
      dryRun: payload.dryRun ?? false,
      highPriorityOnly: payload.highPriorityOnly ?? false,
      includeManualActions: payload.includeManualActions ?? true,
      allowAutomationWithConflicts: payload.allowAutomationWithConflicts ?? false,
      maxActionsPerAsset: payload.maxActionsPerAsset ?? null,
      recentActionCooldownHours: payload.recentActionCooldownHours ?? null,
      useNationalCoherence: payload.useNationalCoherence ?? true,
      materializeFieldEvidence: payload.materializeFieldEvidence ?? true,
    },
  })

  try {
    const metrics = await tenantContext.run(
      {
        tenantId: payload.tenantId,
        requestId: payload.requestId ?? undefined,
      },
      () =>
        assetIntelligenceReconcileService.run({
          tenantId: payload.tenantId,
          limit: payload.limit,
          source: payload.source,
          dryRun: payload.dryRun ?? false,
          highPriorityOnly: payload.highPriorityOnly,
          includeManualActions: payload.includeManualActions,
          allowAutomationWithConflicts: payload.allowAutomationWithConflicts,
          maxActionsPerAsset: payload.maxActionsPerAsset,
          recentActionCooldownHours: payload.recentActionCooldownHours,
          useNationalCoherence: payload.useNationalCoherence,
          materializeFieldEvidence: payload.materializeFieldEvidence,
          requestId: payload.requestId,
        })
    )

    await jobRunService.finish(run.id, 'completed', metrics)

    return metrics
  } catch (error) {
    await jobRunService.finish(run.id, 'failed', null, error)
    throw error
  }
}
