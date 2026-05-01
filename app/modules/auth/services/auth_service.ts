import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import User from '#modules/auth/models/user'
import userRepository from '#modules/auth/repositories/user_repository'
import Tenant from '#modules/tenant/models/tenant'
import TenantMembership from '#modules/tenant/models/tenant_membership'
import Permission from '#modules/permission/models/permission'
import Role from '#modules/permission/models/role'
import UserRole from '#modules/permission/models/user_role'
import { PERMISSIONS, ROLES } from '#modules/permission/seeders_data'

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
    await this.ensureAccessCatalog()

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

  private async ensureAccessCatalog() {
    const permissions = new Map<string, Permission>()

    for (const slug of PERMISSIONS) {
      const permission = await upsertPermission(slug)
      permissions.set(slug, permission)
    }

    for (const roleSeed of ROLES) {
      const role = await upsertRole(roleSeed.slug, roleSeed.name)

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
            created_at: DateTime.now().toSQL(),
          })
          .onConflict(['role_id', 'permission_id'])
          .ignore()
      }
    }
  }
}

async function upsertPermission(slug: string) {
  const existing = await Permission.query().where('slug', slug).first()
  const payload = {
    name: titleize(slug),
    description: permissionDescription(slug),
  }

  if (existing) {
    existing.merge(payload)
    await existing.save()
    return existing
  }

  return Permission.create({ slug, ...payload })
}

async function upsertRole(slug: string, name: string) {
  const existing = await Role.query().where('slug', slug).first()
  const payload = {
    name,
    description: roleDescription(slug),
  }

  if (existing) {
    existing.merge(payload)
    await existing.save()
    return existing
  }

  return Role.create({ slug, ...payload })
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

function titleize(slug: string) {
  return slug
    .split('.')
    .map((part) => part.replace(/_/g, ' '))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function permissionDescription(slug: string) {
  const descriptions: Record<string, string> = {
    'dashboard.read': 'View dashboard metrics and aggregates.',
    'imports.read': 'View SIOP import history and row status.',
    'imports.manage': 'Upload and manage SIOP import jobs.',
    'precatorios.read': 'View precatorio assets and related public data.',
    'debtors.read': 'View debtor profiles and payment context.',
    'pii.reveal': 'Reveal protected beneficiary data through the audited PII flow.',
    'exports.manage': 'Create and inspect export jobs.',
    'integrations.datajud.read': 'View DataJud enrichment and candidate matching data.',
    'integrations.datajud.manage': 'Review and promote DataJud process match candidates.',
    'operations.read': 'View cession desk, opportunity inbox, pricing, and pipeline APIs.',
    'operations.manage': 'Move cession opportunities through the operational pipeline.',
    'market.read': 'View CDI, Selic, IPCA, and EC 136 correction assumptions.',
    'market.manage': 'Sync and maintain market rate curves.',
    'admin.health.read': 'View healthcheck and service status.',
    'admin.jobs.read': 'View Radar job runs and worker activity.',
  }

  return descriptions[slug] ?? titleize(slug)
}

function roleDescription(slug: string) {
  const descriptions: Record<string, string> = {
    owner: 'Acesso completo para configurar a organização, integrações e operação.',
    advocate: 'Conduz análise jurídica, atendimento ao cliente e decisões de encaminhamento.',
    operator: 'Acompanha triagem, contatos, prazos e movimentações operacionais.',
    analyst: 'Pesquisa créditos, devedores e sinais públicos para apoiar a triagem.',
  }

  return descriptions[slug] ?? 'Operational role for the beta workspace.'
}

export default new AuthService()
