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
}
