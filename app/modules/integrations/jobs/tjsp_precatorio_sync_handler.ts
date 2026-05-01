import tjspPrecatorioSyncService from '#modules/integrations/services/tjsp_precatorio_sync_service'
import tenantContext from '#shared/helpers/tenant_context'
import jobRunService from '#shared/services/job_run_service'
import type { TjspPrecatorioCommunicationCategory } from '#modules/integrations/services/tjsp_precatorio_communications_adapter'
import type { JobRunOrigin } from '#shared/types/model_enums'

export const TJSP_PRECATORIO_SYNC_QUEUE = 'tjsp-precatorio-sync'

export type TjspPrecatorioSyncPayload = {
  tenantId: string
  categories?: TjspPrecatorioCommunicationCategory[] | null
  limit?: number | null
  downloadDetails?: boolean
  downloadDocuments?: boolean
  importDocuments?: boolean
  requestId?: string | null
  bullmqJobId?: string | null
  attempts?: number | null
  origin?: JobRunOrigin
}

export async function handleTjspPrecatorioSync(payload: TjspPrecatorioSyncPayload) {
  const run = await jobRunService.start({
    tenantId: payload.tenantId,
    jobName: 'tjsp-precatorio-sync',
    queueName: TJSP_PRECATORIO_SYNC_QUEUE,
    bullmqJobId: payload.bullmqJobId ?? null,
    attempts: payload.attempts ?? null,
    origin: payload.origin ?? 'scheduler',
    metadata: {
      requestId: payload.requestId ?? null,
      categories: payload.categories ?? null,
      limit: payload.limit ?? null,
      downloadDetails: payload.downloadDetails ?? true,
      downloadDocuments: payload.downloadDocuments ?? true,
      importDocuments: payload.importDocuments ?? true,
    },
  })

  try {
    const metrics = await tenantContext.run(
      {
        tenantId: payload.tenantId,
        requestId: payload.requestId ?? undefined,
      },
      () =>
        tjspPrecatorioSyncService.sync({
          tenantId: payload.tenantId,
          categories: payload.categories,
          limit: payload.limit,
          downloadDetails: payload.downloadDetails,
          downloadDocuments: payload.downloadDocuments,
          importDocuments: payload.importDocuments,
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
