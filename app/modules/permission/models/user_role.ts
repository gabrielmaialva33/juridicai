import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Role from '#modules/permission/models/role'
import Tenant from '#modules/tenant/models/tenant'
import User from '#modules/auth/models/user'

export default class UserRole extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare tenantId: string

  @column()
  declare userId: string

  @column()
  declare roleId: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Role)
  declare role: BelongsTo<typeof Role>
}
