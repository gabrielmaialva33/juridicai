import { BaseSchema } from '@adonisjs/lucid/schema'
import { DEFAULT_PERMISSIONS } from '#defaults/permissions'

export default class extends BaseSchema {
  async up() {
    // Get system tenant
    const systemTenant = await this.db.from('tenants').where('subdomain', 'system').first()

    if (!systemTenant) {
      throw new Error('System tenant not found')
    }

    // Insert all default permissions
    const now = this.now()
    for (const permission of DEFAULT_PERMISSIONS) {
      await this.db.table('permissions').insert({
        ...permission,
        tenant_id: systemTenant.id,
        created_at: now,
        updated_at: now,
      })
    }

    // Get roles
    const rootRole = await this.db.from('roles').where('slug', 'root').first()
    const adminRole = await this.db.from('roles').where('slug', 'admin').first()
    const userRole = await this.db.from('roles').where('slug', 'user').first()

    // Get all permission IDs
    const allPermissions = await this.db
      .from('permissions')
      .where('tenant_id', systemTenant.id)
      .select('id')

    // Assign ALL permissions to ROOT
    if (rootRole) {
      for (const perm of allPermissions) {
        await this.db.table('role_permissions').insert({
          role_id: rootRole.id,
          permission_id: perm.id,
        })
      }
    }

    // Assign most permissions to ADMIN (exclude permission management)
    if (adminRole) {
      const adminPermissions = await this.db
        .from('permissions')
        .where('tenant_id', systemTenant.id)
        .whereNot('resource', 'permissions')
        .select('id')

      for (const perm of adminPermissions) {
        await this.db.table('role_permissions').insert({
          role_id: adminRole.id,
          permission_id: perm.id,
        })
      }
    }

    // Assign basic permissions to USER
    if (userRole) {
      const userPermissions = await this.db
        .from('permissions')
        .where('tenant_id', systemTenant.id)
        .whereIn('name', [
          'users.read',
          'users.update',
          'files.create',
          'files.read',
          'files.list',
          'reports.read',
        ])
        .select('id')

      for (const perm of userPermissions) {
        await this.db.table('role_permissions').insert({
          role_id: userRole.id,
          permission_id: perm.id,
        })
      }
    }
  }

  async down() {
    // Remove all permission associations
    await this.db.from('role_permissions').delete()
    await this.db.from('user_permissions').delete()
    await this.db.from('permissions').delete()
  }
}
