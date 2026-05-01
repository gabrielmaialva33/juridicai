import db from '@adonisjs/lucid/services/db'
import Permission from '#modules/permission/models/permission'
import Role from '#modules/permission/models/role'
import Tenant from '#modules/tenant/models/tenant'
import TenantMembership from '#modules/tenant/models/tenant_membership'
import User from '#modules/auth/models/user'
import UserRole from '#modules/permission/models/user_role'
import { PERMISSIONS, ROLES } from '#modules/permission/seeders_data'
import { permissionDescriptions, SEED_PASSWORD } from './radar_seed_data.js'
import { titleize, upsertModel } from './upsert.js'

export async function seedPermissions() {
  const permissions = new Map<string, Permission>()

  for (const slug of PERMISSIONS) {
    const permission = await upsertModel(
      Permission,
      { slug },
      {
        name: titleize(slug),
        description: permissionDescriptions[slug],
      }
    )

    permissions.set(slug, permission)
  }

  return permissions
}

export async function seedRoles(permissions: Map<string, Permission>) {
  const roles = new Map<string, Role>()

  for (const roleSeed of ROLES) {
    const role = await upsertModel(
      Role,
      { slug: roleSeed.slug },
      {
        name: roleSeed.name,
        description: `${roleSeed.name} role for the Radar Federal base workspace.`,
      }
    )

    for (const permissionSlug of roleSeed.permissions) {
      const permission = permissions.get(permissionSlug)
      if (!permission) {
        continue
      }

      await db
        .table('role_permissions')
        .insert({
          role_id: role.id,
          permission_id: permission.id,
          created_at: new Date(),
        })
        .onConflict(['role_id', 'permission_id'])
        .ignore()
    }

    roles.set(roleSeed.slug, role)
  }

  return roles
}

export async function seedTenant() {
  return upsertModel(
    Tenant,
    { slug: 'benicio-capital' },
    {
      name: 'Benício Capital',
      document: '00000000000191',
      status: 'active',
      plan: 'radar-federal-pilot',
      rbacVersion: 1,
    }
  )
}

export async function seedUsers() {
  const owner = await upsertModel(
    User,
    { email: 'owner@juridicai.local' },
    {
      fullName: 'Gabriel Maia',
      password: SEED_PASSWORD,
      status: 'active',
    }
  )

  const analyst = await upsertModel(
    User,
    { email: 'analyst@juridicai.local' },
    {
      fullName: 'Analista Radar',
      password: SEED_PASSWORD,
      status: 'active',
    }
  )

  return { owner, analyst }
}

export async function seedMembershipsAndRoles(
  tenant: Tenant,
  users: { owner: User; analyst: User },
  roles: Map<string, Role>
) {
  await upsertModel(
    TenantMembership,
    { tenantId: tenant.id, userId: users.owner.id },
    { status: 'active' }
  )
  await upsertModel(
    TenantMembership,
    { tenantId: tenant.id, userId: users.analyst.id },
    { status: 'active' }
  )

  const ownerRole = roles.get('owner')
  const analystRole = roles.get('analyst')

  if (ownerRole) {
    await upsertModel(
      UserRole,
      { tenantId: tenant.id, userId: users.owner.id, roleId: ownerRole.id },
      {}
    )
  }

  if (analystRole) {
    await upsertModel(
      UserRole,
      { tenantId: tenant.id, userId: users.analyst.id, roleId: analystRole.id },
      {}
    )
  }
}
