import auditService from '#shared/services/audit_service'
import queueService from '#shared/services/queue_service'
import {
  EXPORT_PRECATORIOS_QUEUE,
  type ExportPrecatoriosPayload,
} from '#modules/exports/jobs/export_precatorios_handler'
import exportJobRepository from '#modules/exports/repositories/export_job_repository'
import tenantContext from '#shared/helpers/tenant_context'
import type { HttpContext } from '@adonisjs/core/http'

export default class ExportsController {
  async index({ response }: HttpContext) {
    const exports = await exportJobRepository.listRecent(tenantContext.requireTenantId())

    return response.ok({
      exports: exports.map((exportJob) => exportJob.serialize()),
    })
  }

  async store({ auth, request, response }: HttpContext) {
    const tenantId = tenantContext.requireTenantId()
    const user = auth.getUserOrFail()
    const filters = request.only(['limit'])
    const exportJob = await exportJobRepository.createPendingPrecatoriosCsv(tenantId, {
      requestedByUserId: user.id,
      filters,
    })

    try {
      const job = await queueService.add<ExportPrecatoriosPayload>(
        EXPORT_PRECATORIOS_QUEUE,
        'exports-precatorios',
        {
          tenantId,
          exportJobId: exportJob.id,
          requestId: tenantContext.get()?.requestId ?? null,
        },
        {
          jobId: `exports-precatorios-${tenantId}-${exportJob.id}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        }
      )

      return response.accepted({
        export: exportJob.serialize(),
        job: {
          id: job.id,
          name: job.name,
        },
      })
    } catch (error) {
      await exportJobRepository.markFailed(
        exportJob,
        error instanceof Error ? error.message : String(error)
      )

      return response.status(503).send({
        code: 'E_EXPORT_QUEUE_UNAVAILABLE',
        message: 'The export queue is unavailable.',
      })
    }
  }

  async show({ params, response }: HttpContext) {
    const exportJob = await exportJobRepository.findByIdOrFail(
      tenantContext.requireTenantId(),
      params.id
    )

    return response.ok({
      export: exportJob.serialize(),
    })
  }

  async download({ auth, params, response, requestId }: HttpContext) {
    const tenantId = tenantContext.requireTenantId()
    const user = auth.getUserOrFail()
    const exportJob = await exportJobRepository.findByIdOrFail(tenantId, params.id)

    if (exportJob.status !== 'completed' || !exportJob.filePath) {
      return response.conflict({
        code: 'E_EXPORT_NOT_READY',
        message: 'The export file is not ready for download.',
      })
    }

    await auditService.write({
      tenantId,
      userId: user.id,
      event: 'precatorios_export_downloaded',
      entityType: 'export_job',
      entityId: exportJob.id,
      requestId,
    })

    return response.attachment(exportJob.filePath, `precatorios-${exportJob.id}.csv`)
  }
}
