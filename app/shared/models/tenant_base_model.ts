import { DateTime } from 'luxon'
import { column, scope } from '@adonisjs/lucid/orm'
import TenantModel from '#shared/models/tenant_model'

/**
 * Base model for tenant-scoped records with soft delete.
 */
export default class TenantBaseModel extends TenantModel {
  @column.dateTime()
  declare deletedAt: DateTime | null

  static notDeleted = scope((query) => {
    query.whereNull('deleted_at')
  })

  static withTenant = scope((query, tenantId: string) => {
    query.where('tenant_id', tenantId).whereNull('deleted_at')
  })

  async softDelete() {
    this.deletedAt = DateTime.now()
    await this.save()
  }
}
