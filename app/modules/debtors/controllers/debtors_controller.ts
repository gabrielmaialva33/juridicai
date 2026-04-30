import debtorService from '#modules/debtors/services/debtor_service'
import tenantContext from '#shared/helpers/tenant_context'
import type { HttpContext } from '@adonisjs/core/http'

export default class DebtorsController {
  async index({ response }: HttpContext) {
    const debtors = await debtorService.listForDashboard(tenantContext.requireTenantId())

    return response.ok({
      debtors: debtors.map((debtor) => debtor.serialize()),
    })
  }

  async show({ params, response }: HttpContext) {
    const debtor = await debtorService.show(tenantContext.requireTenantId(), params.id)

    return response.ok({
      debtor: debtor.serialize(),
    })
  }
}
