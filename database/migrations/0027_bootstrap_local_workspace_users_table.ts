import { BaseSchema } from '@adonisjs/lucid/schema'
import { hash as argon2Hash } from 'argon2'

const DEFAULT_TENANT = {
  slug: 'juridicai-local',
  name: 'JuridicAI Local',
  plan: 'beta',
} as const

const DEFAULT_PASSWORD = 'Juridicai!2026'

const DEFAULT_USERS = [
  {
    email: 'owner@juridicai.local',
    fullName: 'Sócio Gestor',
    role: 'owner',
  },
  {
    email: 'advogado@juridicai.local',
    fullName: 'Advogado Responsável',
    role: 'advocate',
  },
  {
    email: 'operador@juridicai.local',
    fullName: 'Operador de Atendimento',
    role: 'operator',
  },
  {
    email: 'analyst@juridicai.local',
    fullName: 'Analista Jurídico',
    role: 'analyst',
  },
] as const

export default class extends BaseSchema {
  async up() {
    await this.db
      .table('tenants')
      .insert({
        slug: DEFAULT_TENANT.slug,
        name: DEFAULT_TENANT.name,
        plan: DEFAULT_TENANT.plan,
        status: 'active',
        rbac_version: 1,
      })
      .onConflict('slug')
      .merge({
        name: DEFAULT_TENANT.name,
        plan: DEFAULT_TENANT.plan,
        status: 'active',
        updated_at: this.raw('now()'),
      })

    const tenant = await this.db.from('tenants').where('slug', DEFAULT_TENANT.slug).first()
    if (!tenant) {
      throw new Error(`Tenant ${DEFAULT_TENANT.slug} was not persisted.`)
    }

    const passwordHash = await argon2Hash(DEFAULT_PASSWORD, {
      type: 2,
      version: 0x13,
      timeCost: 3,
      memoryCost: 65536,
      parallelism: 4,
      hashLength: 32,
    })

    for (const defaultUser of DEFAULT_USERS) {
      await this.db
        .table('users')
        .insert({
          email: defaultUser.email,
          full_name: defaultUser.fullName,
          password: passwordHash,
          status: 'active',
        })
        .onConflict('email')
        .merge({
          full_name: defaultUser.fullName,
          status: 'active',
          updated_at: this.raw('now()'),
        })

      const user = await this.db.from('users').where('email', defaultUser.email).first()
      const role = await this.db.from('roles').where('slug', defaultUser.role).first()
      if (!user || !role) {
        throw new Error(`Default user ${defaultUser.email} could not be linked.`)
      }

      await this.db
        .table('tenant_memberships')
        .insert({
          tenant_id: tenant.id,
          user_id: user.id,
          status: 'active',
        })
        .onConflict(['tenant_id', 'user_id'])
        .merge({
          status: 'active',
          updated_at: this.raw('now()'),
        })

      await this.db
        .table('user_roles')
        .insert({
          tenant_id: tenant.id,
          user_id: user.id,
          role_id: role.id,
        })
        .onConflict(['tenant_id', 'user_id', 'role_id'])
        .ignore()
    }
  }

  async down() {
    const tenant = await this.db.from('tenants').where('slug', DEFAULT_TENANT.slug).first()
    const emails = DEFAULT_USERS.map((user) => user.email)
    const users = await this.db.from('users').select('id').whereIn('email', emails)
    const userIds = users.map((user) => user.id)

    if (tenant && userIds.length > 0) {
      await this.db
        .from('user_roles')
        .where('tenant_id', tenant.id)
        .whereIn('user_id', userIds)
        .delete()
      await this.db
        .from('tenant_memberships')
        .where('tenant_id', tenant.id)
        .whereIn('user_id', userIds)
        .delete()
    }

    await this.db.from('users').whereIn('email', emails).delete()
    await this.db.from('tenants').where('slug', DEFAULT_TENANT.slug).delete()
  }
}
