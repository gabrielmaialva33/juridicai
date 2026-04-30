import membershipService from '#modules/tenant/services/membership_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class TenantSelectController {
  async index({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const memberships = await membershipService.listUserTenants(user.id)

    return response.ok({
      memberships: memberships.map((membership) => membership.serialize()),
    })
  }

  async store({ auth, request, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const tenantId = request.input('tenant_id')

    if (!tenantId || typeof tenantId !== 'string') {
      return response.status(422).send({
        code: 'E_VALIDATION_FAILED',
        message: 'tenant_id is required.',
      })
    }

    const membership = await membershipService.assertUserBelongsToTenant(tenantId, user.id)

    if (!membership) {
      return response.status(403).send({
        code: 'E_TENANT_FORBIDDEN',
        message: 'The selected tenant is not available for this user.',
      })
    }

    session.put('active_tenant_id', tenantId)

    return response.ok({
      activeTenantId: tenantId,
    })
  }
}
