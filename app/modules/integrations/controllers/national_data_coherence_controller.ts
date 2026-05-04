import nationalDataCoherenceService from '#modules/integrations/services/national_data_coherence_service'
import tenantContext from '#shared/helpers/tenant_context'
import type { HttpContext } from '@adonisjs/core/http'

export default class NationalDataCoherenceController {
  async index({ response }: HttpContext) {
    const report = await nationalDataCoherenceService.build(tenantContext.requireTenantId())

    return response.ok(report)
  }
}
