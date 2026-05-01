import governmentDataSyncOrchestratorService from '#modules/integrations/services/government_data_sync_orchestrator_service'
import tenantContext from '#shared/helpers/tenant_context'
import jobRunService from '#shared/services/job_run_service'
import type { JobRunOrigin, SourceType } from '#shared/types/model_enums'

export const GOVERNMENT_DATA_SYNC_ORCHESTRATOR_QUEUE = 'government-data-sync-orchestrator'

export type GovernmentDataSyncOrchestratorPayload = {
  tenantId: string
  years?: number[] | null
  dataJudCourtAliases?: string[] | null
  dataJudPageSize?: number | null
  dataJudMaxPagesPerCourt?: number | null
  djenCourtAliases?: string[] | null
  djenSearchTexts?: string[] | null
  djenStartDate?: string | null
  djenEndDate?: string | null
  djenMaxPagesPerCourt?: number | null
  enrichLimit?: number | null
  linkLimit?: number | null
  signalLimit?: number | null
  publicationLimit?: number | null
  matchLimit?: number | null
  candidatesPerAsset?: number | null
  source?: SourceType | null
  dryRun?: boolean
  requestId?: string | null
  bullmqJobId?: string | null
  attempts?: number | null
  origin?: JobRunOrigin
}

export async function handleGovernmentDataSyncOrchestrator(
  payload: GovernmentDataSyncOrchestratorPayload
) {
  const run = await jobRunService.start({
    tenantId: payload.tenantId,
    jobName: 'government-data-sync-orchestrator',
    queueName: GOVERNMENT_DATA_SYNC_ORCHESTRATOR_QUEUE,
    bullmqJobId: payload.bullmqJobId ?? null,
    attempts: payload.attempts ?? null,
    origin: payload.origin ?? 'scheduler',
    metadata: {
      requestId: payload.requestId ?? null,
      years: payload.years ?? null,
      dataJudCourtAliases: payload.dataJudCourtAliases ?? null,
      dataJudPageSize: payload.dataJudPageSize ?? null,
      dataJudMaxPagesPerCourt: payload.dataJudMaxPagesPerCourt ?? null,
      djenCourtAliases: payload.djenCourtAliases ?? null,
      djenSearchTexts: payload.djenSearchTexts ?? null,
      djenStartDate: payload.djenStartDate ?? null,
      djenEndDate: payload.djenEndDate ?? null,
      djenMaxPagesPerCourt: payload.djenMaxPagesPerCourt ?? null,
      enrichLimit: payload.enrichLimit ?? null,
      linkLimit: payload.linkLimit ?? null,
      signalLimit: payload.signalLimit ?? null,
      publicationLimit: payload.publicationLimit ?? null,
      matchLimit: payload.matchLimit ?? null,
      candidatesPerAsset: payload.candidatesPerAsset ?? null,
      source: payload.source ?? null,
      dryRun: payload.dryRun ?? false,
    },
  })

  try {
    const metrics = await tenantContext.run(
      {
        tenantId: payload.tenantId,
        requestId: payload.requestId ?? undefined,
      },
      () => governmentDataSyncOrchestratorService.run(payload)
    )

    await jobRunService.finish(run.id, 'completed', metrics)

    return metrics
  } catch (error) {
    await jobRunService.finish(run.id, 'failed', null, error)
    throw error
  }
}
