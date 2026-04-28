import precatorioService from '#modules/precatorios/services/precatorio_service'
import tenantContext from '#shared/helpers/tenant_context'
import type { HttpContext } from '@adonisjs/core/http'

export default class PrecatoriosController {
  async index({ response, request }: HttpContext) {
    const page = request.input('page', 1)
    const assets = await precatorioService.listLatest(tenantContext.requireTenantId(), page)

    return response.ok({
      assets: assets.serialize(),
    })
  }
}
