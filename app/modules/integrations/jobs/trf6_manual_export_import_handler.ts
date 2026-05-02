import trf6PrecatorioImportService from '#modules/integrations/services/trf6_precatorio_import_service'
import {
  POST_IMPORT_ENRICHMENT_QUEUE,
  type PostImportEnrichmentPayload,
} from '#modules/integrations/jobs/post_import_enrichment_handler'
import tenantContext from '#shared/helpers/tenant_context'
import jobRunService from '#shared/services/job_run_service'
import queueService from '#shared/services/queue_service'
import type { JobRunOrigin } from '#shared/types/model_enums'

export const TRF6_MANUAL_EXPORT_IMPORT_QUEUE = 'trf6-manual-export-import'

export type Trf6ManualExportImportPayload = {
  tenantId: string
  sourceRecordId: string
  chunkSize?: number | null
  requestId?: string | null
  bullmqJobId?: string | null
  attempts?: number | null
  origin?: JobRunOrigin
  enqueuePostImportEnrichment?: boolean
}

export async function handleTrf6ManualExportImport(payload: Trf6ManualExportImportPayload) {
  const run = await jobRunService.start({
    tenantId: payload.tenantId,
    jobName: 'trf6-manual-export-import',
    queueName: TRF6_MANUAL_EXPORT_IMPORT_QUEUE,
    bullmqJobId: payload.bullmqJobId ?? null,
    attempts: payload.attempts ?? null,
    origin: payload.origin ?? 'http',
    metadata: {
      requestId: payload.requestId ?? null,
      sourceRecordId: payload.sourceRecordId,
      chunkSize: payload.chunkSize ?? null,
    },
  })

  try {
    const result = await tenantContext.run(
      {
        tenantId: payload.tenantId,
        requestId: payload.requestId ?? undefined,
      },
      () =>
        trf6PrecatorioImportService.importSourceRecord(payload.sourceRecordId, {
          chunkSize: payload.chunkSize ?? 500,
        })
    )
    const metrics = {
      sourceRecordId: result.sourceRecord.id,
      extraction: {
        format: result.extraction.format,
        status: result.extraction.status,
        rows: result.extraction.rows.length,
        errors: result.extraction.errors,
      },
      stats: result.stats,
      chunking: result.chunking,
      postImportEnrichmentJob: null as null | { id: string | number | null; name: string },
    }

    if (payload.enqueuePostImportEnrichment === true) {
      const job = await queueService.add<PostImportEnrichmentPayload>(
        POST_IMPORT_ENRICHMENT_QUEUE,
        'post-import-enrichment',
        {
          tenantId: payload.tenantId,
          sourceRecordId: result.sourceRecord.id,
          source: 'tribunal',
          requestId: payload.requestId ?? null,
          origin: 'system',
        },
        {
          jobId: `post-import-enrichment-${payload.tenantId}-${result.sourceRecord.id}-${Date.now()}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        }
      )

      metrics.postImportEnrichmentJob = {
        id: job.id ?? null,
        name: job.name,
      }
    }

    await jobRunService.finish(run.id, 'completed', metrics)
    return metrics
  } catch (error) {
    await jobRunService.finish(run.id, 'failed', null, error)
    throw error
  }
}
