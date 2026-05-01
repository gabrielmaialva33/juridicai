import siopOpenDataSyncService from '#modules/integrations/services/siop_open_data_sync_service'
import tenantContext from '#shared/helpers/tenant_context'
import jobRunService from '#shared/services/job_run_service'
import type { JobRunOrigin } from '#shared/types/model_enums'

export const SIOP_OPEN_DATA_SYNC_QUEUE = 'siop-open-data-sync'

export type SiopOpenDataSyncPayload = {
  tenantId: string
  years?: number[] | null
  download?: boolean
  enqueueImports?: boolean
  requestId?: string | null
  bullmqJobId?: string | null
  attempts?: number | null
  origin?: JobRunOrigin
}

export async function handleSiopOpenDataSync(payload: SiopOpenDataSyncPayload) {
  const run = await jobRunService.start({
    tenantId: payload.tenantId,
    jobName: 'siop-open-data-sync',
    queueName: SIOP_OPEN_DATA_SYNC_QUEUE,
    bullmqJobId: payload.bullmqJobId ?? null,
    attempts: payload.attempts ?? null,
    origin: payload.origin ?? 'scheduler',
    metadata: {
      requestId: payload.requestId ?? null,
      years: payload.years ?? null,
      download: payload.download ?? true,
      enqueueImports: payload.enqueueImports ?? true,
    },
  })

  try {
    const metrics = await tenantContext.run(
      {
        tenantId: payload.tenantId,
        requestId: payload.requestId ?? undefined,
      },
      () =>
        siopOpenDataSyncService.sync({
          tenantId: payload.tenantId,
          years: payload.years,
          download: payload.download,
          enqueueImports: payload.enqueueImports,
          origin: payload.origin ?? 'scheduler',
        })
    )

    await jobRunService.finish(run.id, 'completed', metrics)

    return metrics
  } catch (error) {
    await jobRunService.finish(run.id, 'failed', null, error)
    throw error
  }
}
