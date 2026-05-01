import dataJudNationalPrecatorioSyncService from '#modules/integrations/services/datajud_national_precatorio_sync_service'
import tenantContext from '#shared/helpers/tenant_context'
import jobRunService from '#shared/services/job_run_service'
import type { JobRunOrigin } from '#shared/types/model_enums'

export const DATAJUD_NATIONAL_PRECATORIO_SYNC_QUEUE = 'datajud-national-precatorio-sync'

export type DataJudNationalPrecatorioSyncPayload = {
  tenantId: string
  courtAliases?: string[] | null
  pageSize?: number | null
  maxPagesPerCourt?: number | null
  requestId?: string | null
  bullmqJobId?: string | null
  attempts?: number | null
  origin?: JobRunOrigin
}

export async function handleDataJudNationalPrecatorioSync(
  payload: DataJudNationalPrecatorioSyncPayload
) {
  const run = await jobRunService.start({
    tenantId: payload.tenantId,
    jobName: 'datajud-national-precatorio-sync',
    queueName: DATAJUD_NATIONAL_PRECATORIO_SYNC_QUEUE,
    bullmqJobId: payload.bullmqJobId ?? null,
    attempts: payload.attempts ?? null,
    origin: payload.origin ?? 'scheduler',
    metadata: {
      requestId: payload.requestId ?? null,
      courtAliases: payload.courtAliases ?? null,
      pageSize: payload.pageSize ?? null,
      maxPagesPerCourt: payload.maxPagesPerCourt ?? null,
    },
  })

  try {
    const metrics = await tenantContext.run(
      {
        tenantId: payload.tenantId,
        requestId: payload.requestId ?? undefined,
      },
      () =>
        dataJudNationalPrecatorioSyncService.sync({
          tenantId: payload.tenantId,
          courtAliases: payload.courtAliases,
          pageSize: payload.pageSize,
          maxPagesPerCourt: payload.maxPagesPerCourt,
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
