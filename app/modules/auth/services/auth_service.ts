import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import User from '#modules/auth/models/user'
import userRepository from '#modules/auth/repositories/user_repository'
import tenantRepository from '#modules/tenant/repositories/tenant_repository'
import tenantMembershipRepository from '#modules/tenant/repositories/tenant_membership_repository'
import roleRepository from '#modules/permission/repositories/role_repository'
import userRoleRepository from '#modules/permission/repositories/user_role_repository'

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
      const user = await userRepository.create(
        {
          fullName: payload.fullName,
          email: payload.email,
          password: payload.password,
        },
        trx
      )
      const tenant = await tenantRepository.create(
        {
          name: payload.organizationName,
          slug: await uniqueTenantSlug(payload.organizationName, trx),
          document: payload.organizationDocument || null,
          status: 'active',
          plan: 'beta',
          rbacVersion: 1,
        },
        trx
      )
      const ownerRole = await roleRepository.findBySlugOrFail('owner', trx)

      await tenantMembershipRepository.createMembership(
        tenant.id,
        {
          userId: user.id,
          status: 'active',
        },
        trx
      )
      await userRoleRepository.createAssignment(
        tenant.id,
        {
          userId: user.id,
          roleId: ownerRole.id,
        },
        trx
      )

      return { user, tenant }
    })
  }
}

async function uniqueTenantSlug(name: string, trx?: TransactionClientContract) {
  const base = slugify(name) || 'workspace'
  let candidate = base
  let suffix = 2

  while (await tenantRepository.slugExists(candidate, trx)) {
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
