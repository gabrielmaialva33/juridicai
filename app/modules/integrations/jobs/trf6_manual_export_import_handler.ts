import trf6PrecatorioImportService from '#modules/integrations/services/trf6_precatorio_import_service'
import tenantContext from '#shared/helpers/tenant_context'
import jobRunService from '#shared/services/job_run_service'
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
    }

    await jobRunService.finish(run.id, 'completed', metrics)
    return metrics
  } catch (error) {
    await jobRunService.finish(run.id, 'failed', null, error)
    throw error
  }
}
