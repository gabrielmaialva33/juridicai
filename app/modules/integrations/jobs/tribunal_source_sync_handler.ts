import tribunalSourceSyncService, {
  type TribunalSourceSyncOptions,
} from '#modules/integrations/services/tribunal_source_sync_service'
import tenantContext from '#shared/helpers/tenant_context'
import jobRunService from '#shared/services/job_run_service'

export const TRIBUNAL_SOURCE_SYNC_QUEUE = 'tribunal-source-sync'

export type TribunalSourceSyncPayload = TribunalSourceSyncOptions & {
  requestId?: string | null
  bullmqJobId?: string | null
  attempts?: number | null
}

export async function handleTribunalSourceSync(payload: TribunalSourceSyncPayload) {
  const run = await jobRunService.start({
    tenantId: payload.tenantId,
    jobName: 'tribunal-source-sync',
    queueName: TRIBUNAL_SOURCE_SYNC_QUEUE,
    bullmqJobId: payload.bullmqJobId ?? null,
    attempts: payload.attempts ?? null,
    origin: payload.origin ?? 'scheduler',
    metadata: {
      requestId: payload.requestId ?? null,
      targetKeys: payload.targetKeys ?? null,
      sourceDatasetKeys: payload.sourceDatasetKeys ?? null,
      courtAliases: payload.courtAliases ?? null,
      adapterKeys: payload.adapterKeys ?? null,
      statuses: payload.statuses ?? null,
      limit: payload.limit ?? null,
      trf1Years: payload.trf1Years ?? null,
      trf1Kinds: payload.trf1Kinds ?? null,
      trf1Limit: payload.trf1Limit ?? null,
      trf3Years: payload.trf3Years ?? null,
      trf3Months: payload.trf3Months ?? null,
      trf3Formats: payload.trf3Formats ?? null,
      trf3Limit: payload.trf3Limit ?? null,
      trf3ImportLimit: payload.trf3ImportLimit ?? null,
      trf3ImportChunkSize: payload.trf3ImportChunkSize ?? null,
      trf4ImportLimit: payload.trf4ImportLimit ?? null,
      trf4ImportChunkSize: payload.trf4ImportChunkSize ?? null,
      trf5Years: payload.trf5Years ?? null,
      trf5Kinds: payload.trf5Kinds ?? null,
      trf5Limit: payload.trf5Limit ?? null,
      trf5ImportLimit: payload.trf5ImportLimit ?? null,
      trf5ImportChunkSize: payload.trf5ImportChunkSize ?? null,
      trf6Years: payload.trf6Years ?? null,
      trf6Limit: payload.trf6Limit ?? null,
      trf6ImportLimit: payload.trf6ImportLimit ?? null,
      trf6ImportChunkSize: payload.trf6ImportChunkSize ?? null,
      dryRun: payload.dryRun ?? false,
    },
  })

  try {
    const metrics = await tenantContext.run(
      {
        tenantId: payload.tenantId,
        requestId: payload.requestId ?? undefined,
      },
      () => tribunalSourceSyncService.sync(payload)
    )

    await jobRunService.finish(run.id, 'completed', metrics)

    return metrics
  } catch (error) {
    await jobRunService.finish(run.id, 'failed', null, error)
    throw error
  }
}
