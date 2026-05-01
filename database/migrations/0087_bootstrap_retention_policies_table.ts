import { BaseSchema } from '@adonisjs/lucid/schema'

const DEFAULT_TENANT_SLUG = 'juridicai-local'

const RETENTION_POLICIES = [
  ['audit_logs', 2555],
  ['pii_access_logs', 2555],
  ['source_records', 3650],
  ['exports', 30],
  ['client_errors', 90],
] as const

export default class extends BaseSchema {
  async up() {
    const tenant = await this.db.from('tenants').where('slug', DEFAULT_TENANT_SLUG).first()
    if (!tenant) {
      throw new Error(`Tenant ${DEFAULT_TENANT_SLUG} is required before retention bootstrap.`)
    }

    for (const [subject, retentionDays] of RETENTION_POLICIES) {
      await this.db
        .table('retention_config')
        .insert({
          tenant_id: tenant.id,
          subject,
          retention_days: retentionDays,
          enabled: true,
        })
        .onConflict(['tenant_id', 'subject'])
        .merge({
          retention_days: retentionDays,
          enabled: true,
          updated_at: this.raw('now()'),
        })
    }
  }

  async down() {
    const tenant = await this.db.from('tenants').where('slug', DEFAULT_TENANT_SLUG).first()
    if (!tenant) {
      return
    }

    await this.db.from('retention_config').where('tenant_id', tenant.id).delete()
  }
}
