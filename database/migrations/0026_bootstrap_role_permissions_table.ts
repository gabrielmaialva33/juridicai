import { BaseSchema } from '@adonisjs/lucid/schema'

const PERMISSIONS = [
  'dashboard.read',
  'imports.read',
  'imports.manage',
  'precatorios.read',
  'debtors.read',
  'pii.reveal',
  'exports.manage',
  'integrations.datajud.read',
  'integrations.datajud.manage',
  'operations.read',
  'operations.manage',
  'market.read',
  'market.manage',
  'admin.health.read',
  'admin.jobs.read',
] as const

const ROLE_PERMISSIONS = {
  owner: [...PERMISSIONS],
  advocate: [
    'dashboard.read',
    'imports.read',
    'precatorios.read',
    'debtors.read',
    'pii.reveal',
    'integrations.datajud.read',
    'operations.read',
    'operations.manage',
    'market.read',
  ],
  operator: [
    'dashboard.read',
    'precatorios.read',
    'debtors.read',
    'operations.read',
    'operations.manage',
    'market.read',
  ],
  analyst: [
    'dashboard.read',
    'imports.read',
    'precatorios.read',
    'debtors.read',
    'integrations.datajud.read',
    'operations.read',
    'market.read',
  ],
} as const

export default class extends BaseSchema {
  async up() {
    for (const [roleSlug, permissionSlugs] of Object.entries(ROLE_PERMISSIONS)) {
      const role = await this.db.from('roles').where('slug', roleSlug).first()
      if (!role) {
        throw new Error(`Role ${roleSlug} is required before assigning permissions.`)
      }

      for (const permissionSlug of permissionSlugs) {
        const permission = await this.db.from('permissions').where('slug', permissionSlug).first()
        if (!permission) {
          throw new Error(`Permission ${permissionSlug} is required before role assignment.`)
        }

        await this.db
          .table('role_permissions')
          .insert({
            role_id: role.id,
            permission_id: permission.id,
          })
          .onConflict(['role_id', 'permission_id'])
          .ignore()
      }
    }
  }

  async down() {
    const roleSlugs = Object.keys(ROLE_PERMISSIONS)
    const roles = await this.db.from('roles').select('id').whereIn('slug', roleSlugs)

    await this.db
      .from('role_permissions')
      .whereIn(
        'role_id',
        roles.map((role) => role.id)
      )
      .delete()
  }
}
