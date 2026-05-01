import db from '@adonisjs/lucid/services/db'
import tenantContext from '#shared/helpers/tenant_context'
import type { HttpContext } from '@adonisjs/core/http'

export default class ProfileController {
  async show({ auth, inertia }: HttpContext) {
    const user = auth.getUserOrFail()
    const tenantId = tenantContext.requireTenantId()

    const membership = await db
      .from('tenant_memberships as tm')
      .join('tenants as t', 't.id', 'tm.tenant_id')
      .where('tm.tenant_id', tenantId)
      .where('tm.user_id', user.id)
      .select('tm.id', 'tm.status', 'tm.created_at as createdAt', 't.name as tenantName', 't.slug')
      .first()

    const roles = await db
      .from('user_roles as ur')
      .join('roles as r', 'r.id', 'ur.role_id')
      .where('ur.tenant_id', tenantId)
      .where('ur.user_id', user.id)
      .orderBy('r.name', 'asc')
      .select('r.id', 'r.name', 'r.slug')

    return inertia.render('profile/show', {
      profile: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          initials: user.initials,
          status: user.status,
          createdAt: user.createdAt.toJSDate().toISOString(),
          updatedAt: user.updatedAt.toJSDate().toISOString(),
        },
        membership,
        roles,
      },
    })
  }
}
