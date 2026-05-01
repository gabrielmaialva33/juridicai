import db from '@adonisjs/lucid/services/db'
import tenantContext from '#shared/helpers/tenant_context'
import type { HttpContext } from '@adonisjs/core/http'

const OPERATIONAL_ROLE_SLUGS = ['owner', 'analyst'] as const

export default class SettingsController {
  async tenant({ inertia }: HttpContext) {
    const tenantId = tenantContext.requireTenantId()
    const tenant = await db.from('tenants').where('id', tenantId).first()
    const memberCount = await db
      .from('tenant_memberships')
      .where('tenant_id', tenantId)
      .where('status', 'active')
      .count('* as total')

    return inertia.render('settings/tenant', {
      tenant: tenant as any,
      activeMemberCount: Number(memberCount[0].total ?? 0),
    })
  }

  async users({ inertia }: HttpContext) {
    const tenantId = tenantContext.requireTenantId()

    const memberships = await db
      .from('tenant_memberships as tm')
      .join('users as u', 'u.id', 'tm.user_id')
      .where('tm.tenant_id', tenantId)
      .select(
        'u.id',
        'u.full_name as fullName',
        'u.email',
        'u.status as userStatus',
        'tm.id as membershipId',
        'tm.status as membershipStatus',
        'tm.created_at as joinedAt'
      )
      .orderBy('u.full_name', 'asc')

    const userIds = memberships.map((m) => m.id)
    const userRoles =
      userIds.length > 0
        ? await db
            .from('user_roles as ur')
            .join('roles as r', 'r.id', 'ur.role_id')
            .where('ur.tenant_id', tenantId)
            .whereIn('ur.user_id', userIds)
            .select('ur.user_id as userId', 'r.id as roleId', 'r.name', 'r.slug')
        : []

    const rolesByUser: Record<string, any[]> = {}
    for (const ur of userRoles) {
      rolesByUser[ur.userId] = rolesByUser[ur.userId] ?? []
      rolesByUser[ur.userId].push({ id: ur.roleId, name: ur.name, slug: ur.slug })
    }

    const allRoles = await db
      .from('roles as r')
      .join('role_permissions as rp', 'rp.role_id', 'r.id')
      .whereIn('r.slug', [...OPERATIONAL_ROLE_SLUGS])
      .select('r.id', 'r.name', 'r.slug', 'r.description')
      .count('rp.permission_id as permissionCount')
      .groupBy('r.id', 'r.name', 'r.slug', 'r.description')
      .orderBy('r.name', 'asc')

    return inertia.render('settings/users', {
      memberships: memberships.map((m) => ({ ...m, roles: rolesByUser[m.id] ?? [] })) as any,
      allRoles: allRoles as any,
    })
  }
}
