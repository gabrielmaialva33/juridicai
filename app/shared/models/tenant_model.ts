import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, column, scope } from '@adonisjs/lucid/orm'

/**
 * Base model for tenant-scoped records without soft delete.
 */
export default class TenantModel extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare tenantId: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @beforeCreate()
  static assignUuid(model: TenantModel) {
    if (!model.id) {
      model.id = randomUUID()
    }
  }

  static forTenant = scope((query, tenantId: string) => {
    query.where('tenant_id', tenantId)
  })
}
