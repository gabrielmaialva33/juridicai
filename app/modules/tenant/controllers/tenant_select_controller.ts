import membershipService from '#modules/tenant/services/membership_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class TenantSelectController {
  async index({ auth, inertia, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const memberships = await membershipService.listUserTenants(user.id)

    // Auto-select if user has only one membership
    if (memberships.length === 1) {
      session.put('active_tenant_id', memberships[0].tenantId)
      return response.redirect('/operations/desk')
    }

    return inertia.render('tenants/select', {
      memberships: memberships.map((membership) => membership.serialize()) as any,
    })
  }

  async store({ auth, request, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const tenantId = request.input('tenant_id')

    if (!tenantId || typeof tenantId !== 'string') {
      session.flash('error', 'Selecione uma organização válida.')
      return response.redirect().back()
    }

    const membership = await membershipService.assertUserBelongsToTenant(tenantId, user.id)

    if (!membership) {
      session.flash('error', 'Você não tem acesso a esta organização.')
      return response.redirect().back()
    }

    session.put('active_tenant_id', tenantId)
    return response.redirect('/operations/desk')
  }
}
