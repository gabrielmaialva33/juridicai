import revealService from '#modules/pii/services/reveal_service'
import tenantContext from '#shared/helpers/tenant_context'
import type { HttpContext } from '@adonisjs/core/http'

export default class RevealController {
  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const beneficiary = await revealService.revealBeneficiary(
      tenantContext.requireTenantId(),
      user.id,
      params.id
    )

    return response.ok({ beneficiary })
  }
}
