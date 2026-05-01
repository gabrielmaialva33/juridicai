import dataJudProcessAssetLinkService from '#modules/integrations/services/datajud_process_asset_link_service'
import tenantContext from '#shared/helpers/tenant_context'
import jobRunService from '#shared/services/job_run_service'
import type { JobRunOrigin } from '#shared/types/model_enums'

export const DATAJUD_PROCESS_ASSET_LINK_QUEUE = 'datajud-process-asset-link'

export type DataJudProcessAssetLinkPayload = {
  tenantId: string
  limit?: number | null
  projectSignals?: boolean
  requestId?: string | null
  bullmqJobId?: string | null
  attempts?: number | null
  origin?: JobRunOrigin
}

export async function handleDataJudProcessAssetLink(payload: DataJudProcessAssetLinkPayload) {
  const run = await jobRunService.start({
    tenantId: payload.tenantId,
    jobName: 'datajud-process-asset-link',
    queueName: DATAJUD_PROCESS_ASSET_LINK_QUEUE,
    bullmqJobId: payload.bullmqJobId ?? null,
    attempts: payload.attempts ?? null,
    origin: payload.origin ?? 'system',
    metadata: {
      requestId: payload.requestId ?? null,
      limit: payload.limit ?? null,
      projectSignals: payload.projectSignals ?? true,
    },
  })

  try {
    const metrics = await tenantContext.run(
      {
        tenantId: payload.tenantId,
        requestId: payload.requestId ?? undefined,
      },
      () =>
        dataJudProcessAssetLinkService.link({
          tenantId: payload.tenantId,
          limit: payload.limit,
          projectSignals: payload.projectSignals,
        })
    )

    await jobRunService.finish(run.id, 'completed', metrics)

    return metrics
  } catch (error) {
    await jobRunService.finish(run.id, 'failed', null, error)
    throw error
  }
}
