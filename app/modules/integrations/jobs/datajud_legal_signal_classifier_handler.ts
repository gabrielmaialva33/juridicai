import dataJudLegalSignalClassifierService from '#modules/integrations/services/datajud_legal_signal_classifier_service'
import tenantContext from '#shared/helpers/tenant_context'
import jobRunService from '#shared/services/job_run_service'
import type { JobRunOrigin } from '#shared/types/model_enums'

export const DATAJUD_LEGAL_SIGNAL_CLASSIFIER_QUEUE = 'datajud-legal-signal-classifier'

export type DataJudLegalSignalClassifierPayload = {
  tenantId: string
  limit?: number | null
  processId?: string | null
  projectAssetEvents?: boolean
  requestId?: string | null
  bullmqJobId?: string | null
  attempts?: number | null
  origin?: JobRunOrigin
}

export async function handleDataJudLegalSignalClassifier(
  payload: DataJudLegalSignalClassifierPayload
) {
  const run = await jobRunService.start({
    tenantId: payload.tenantId,
    jobName: 'datajud-legal-signal-classifier',
    queueName: DATAJUD_LEGAL_SIGNAL_CLASSIFIER_QUEUE,
    bullmqJobId: payload.bullmqJobId ?? null,
    attempts: payload.attempts ?? null,
    origin: payload.origin ?? 'system',
    metadata: {
      requestId: payload.requestId ?? null,
      limit: payload.limit ?? null,
      processId: payload.processId ?? null,
      projectAssetEvents: payload.projectAssetEvents ?? true,
    },
  })

  try {
    const metrics = await tenantContext.run(
      {
        tenantId: payload.tenantId,
        requestId: payload.requestId ?? undefined,
      },
      () =>
        dataJudLegalSignalClassifierService.classify({
          tenantId: payload.tenantId,
          limit: payload.limit,
          processId: payload.processId,
          projectAssetEvents: payload.projectAssetEvents,
        })
    )

    await jobRunService.finish(run.id, 'completed', metrics)

    return metrics
  } catch (error) {
    await jobRunService.finish(run.id, 'failed', null, error)
    throw error
  }
}
