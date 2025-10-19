import { BaseSchema } from '@adonisjs/lucid/schema'
import { DEFAULT_ROLES } from '#defaults/roles'

export default class extends BaseSchema {
  async up() {
    // Get system tenant
    const systemTenant = await this.db.from('tenants').where('subdomain', 'system').first()

    if (!systemTenant) {
      throw new Error(
        'System tenant not found. Make sure create_system_tenant migration runs first.'
      )
    }

    // Insert default roles
    const now = this.now()
    for (const role of DEFAULT_ROLES) {
      await this.db.table('roles').insert({
        ...role,
        tenant_id: systemTenant.id,
        created_at: now,
        updated_at: now,
      })
    }
  }

  async down() {
    const systemTenant = await this.db.from('tenants').where('subdomain', 'system').first()
    if (systemTenant) {
      await this.db.from('roles').where('tenant_id', systemTenant.id).delete()
    }
  }
}
