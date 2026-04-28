import dashboardService from '#modules/dashboard/services/dashboard_service'
import tenantContext from '#shared/helpers/tenant_context'
import type { HttpContext } from '@adonisjs/core/http'

export default class DashboardController {
  async index({ response }: HttpContext) {
    return response.ok(await dashboardService.overview(tenantContext.requireTenantId()))
  }
}
