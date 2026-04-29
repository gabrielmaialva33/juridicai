import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Permission from '#modules/permission/models/permission'
import Role from '#modules/permission/models/role'

export default class RolePermission extends BaseModel {
  static table = 'role_permissions'

  @column({ isPrimary: true })
  declare roleId: string

  @column()
  declare permissionId: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => Role)
  declare role: BelongsTo<typeof Role>

  @belongsTo(() => Permission)
  declare permission: BelongsTo<typeof Permission>
}
