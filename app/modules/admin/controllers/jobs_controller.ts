import RadarJobRun from '#modules/admin/models/radar_job_run'
import tenantContext from '#shared/helpers/tenant_context'
import type { HttpContext } from '@adonisjs/core/http'

export default class JobsController {
  async index({ response }: HttpContext) {
    const runs = await RadarJobRun.query()
      .where('tenant_id', tenantContext.requireTenantId())
      .orderBy('created_at', 'desc')
      .limit(25)

    return response.ok({ runs: runs.map((run) => run.serialize()) })
  }
}
