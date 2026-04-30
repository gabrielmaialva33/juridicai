import queueService from '#shared/services/queue_service'
import {
  SIOP_IMPORT_QUEUE,
  handleSiopImport,
  type SiopImportJobPayload,
} from '#modules/siop/jobs/siop_import_handler'
import {
  EXPORT_PRECATORIOS_QUEUE,
  handleExportPrecatorios,
  type ExportPrecatoriosPayload,
} from '#modules/exports/jobs/export_precatorios_handler'

let booted = false

export function bootWorkers() {
  if (booted) {
    return
  }

  queueService.registerWorker<SiopImportJobPayload>(SIOP_IMPORT_QUEUE, async (job) => {
    await handleSiopImport({
      ...job.data,
      bullmqJobId: job.id ? String(job.id) : null,
      attempts: job.attemptsMade + 1,
    })
  })

  queueService.registerWorker<ExportPrecatoriosPayload>(EXPORT_PRECATORIOS_QUEUE, async (job) => {
    await handleExportPrecatorios({
      ...job.data,
      bullmqJobId: job.id ? String(job.id) : null,
      attempts: job.attemptsMade + 1,
    })
  })

  booted = true
}

export async function shutdownWorkers() {
  if (!booted) {
    return
  }

  await queueService.shutdown()
  booted = false
}
