import governmentCoverageMatrixService from '#modules/integrations/services/government_coverage_matrix_service'
import tenantContext from '#shared/helpers/tenant_context'
import type { HttpContext } from '@adonisjs/core/http'

export default class GovernmentCoverageController {
  async index({ response }: HttpContext) {
    const matrix = await governmentCoverageMatrixService.build(tenantContext.requireTenantId())

    return response.ok(matrix)
  }
}
