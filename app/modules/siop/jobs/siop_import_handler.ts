import siopImportService from '#modules/siop/services/siop_import_service'
import {
  POST_IMPORT_ENRICHMENT_QUEUE,
  type PostImportEnrichmentPayload,
} from '#modules/integrations/jobs/post_import_enrichment_handler'
import tenantContext from '#shared/helpers/tenant_context'
import jobRunService from '#shared/services/job_run_service'
import queueService from '#shared/services/queue_service'

export const SIOP_IMPORT_QUEUE = 'siop-imports'

export type SiopImportJobPayload = {
  tenantId: string
  importId: string
  requestId?: string | null
  bullmqJobId?: string | null
  attempts?: number | null
  origin?: 'http' | 'manual_retry' | 'system'
  enqueuePostImportEnrichment?: boolean
}

export async function handleSiopImport(payload: SiopImportJobPayload) {
  const run = await jobRunService.start({
    tenantId: payload.tenantId,
    jobName: 'siop-import',
    queueName: SIOP_IMPORT_QUEUE,
    bullmqJobId: payload.bullmqJobId ?? null,
    attempts: payload.attempts ?? null,
    origin: payload.origin ?? 'http',
    metadata: {
      importId: payload.importId,
      requestId: payload.requestId ?? null,
    },
  })

  try {
    const result = await tenantContext.run(
      {
        tenantId: payload.tenantId,
        requestId: payload.requestId ?? undefined,
      },
      () => siopImportService.processImportFile(payload.importId)
    )

    if (result.skipped) {
      await jobRunService.skip(run.id, result.reason ?? 'skipped', result.stats)
      return result.stats
    }

    const postImportEnrichmentJob =
      payload.enqueuePostImportEnrichment !== true
        ? null
        : await queueService.add<PostImportEnrichmentPayload>(
            POST_IMPORT_ENRICHMENT_QUEUE,
            'post-import-enrichment',
            {
              tenantId: payload.tenantId,
              sourceRecordId: result.import.sourceRecordId,
              source: 'siop',
              requestId: payload.requestId ?? null,
              origin: 'system',
            },
            {
              jobId: `post-import-enrichment-${payload.tenantId}-${result.import.sourceRecordId}-${Date.now()}`,
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 1000,
              },
            }
          )

    await jobRunService.finish(run.id, 'completed', {
      ...result.stats,
      postImportEnrichmentJob: postImportEnrichmentJob
        ? {
            id: postImportEnrichmentJob.id ?? null,
            name: postImportEnrichmentJob.name,
          }
        : null,
    })

    return result.stats
  } catch (error) {
    await jobRunService.finish(run.id, 'failed', null, error)
    throw error
  }
}
