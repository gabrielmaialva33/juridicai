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
}
