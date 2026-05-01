import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import User from '#modules/auth/models/user'
import userRepository from '#modules/auth/repositories/user_repository'
import Tenant from '#modules/tenant/models/tenant'
import TenantMembership from '#modules/tenant/models/tenant_membership'
import Role from '#modules/permission/models/role'
import UserRole from '#modules/permission/models/user_role'

class AuthService {
  verifyCredentials(email: string, password: string) {
    return User.verifyCredentials(email, password)
  }

  createUser(payload: { fullName?: string | null; email: string; password: string }) {
    return userRepository.create(payload)
  }

  async createWorkspaceOwner(payload: {
    fullName?: string | null
    email: string
    password: string
    organizationName: string
    organizationDocument?: string | null
  }) {
    return db.transaction(async (trx) => {
      const user = await User.create(
        {
          fullName: payload.fullName,
          email: payload.email,
          password: payload.password,
        },
        { client: trx }
      )
      const tenant = await Tenant.create(
        {
          name: payload.organizationName,
          slug: await uniqueTenantSlug(payload.organizationName, trx),
          document: payload.organizationDocument || null,
          status: 'active',
          plan: 'beta',
          rbacVersion: 1,
        },
        { client: trx }
      )
      const ownerRole = await Role.query({ client: trx }).where('slug', 'owner').firstOrFail()

      await TenantMembership.create(
        {
          tenantId: tenant.id,
          userId: user.id,
          status: 'active',
        },
        { client: trx }
      )
      await UserRole.create(
        {
          tenantId: tenant.id,
          userId: user.id,
          roleId: ownerRole.id,
        },
        { client: trx }
      )

      return { user, tenant }
    })
  }
}

async function uniqueTenantSlug(name: string, trx?: TransactionClientContract) {
  const base = slugify(name) || 'workspace'
  let candidate = base
  let suffix = 2

  while (await Tenant.query({ client: trx }).where('slug', candidate).first()) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }

  return candidate
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export default new AuthService()
