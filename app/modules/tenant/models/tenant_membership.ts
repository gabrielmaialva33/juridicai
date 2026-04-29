import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { MembershipStatus } from '#shared/types/model_enums'
import Tenant from '#modules/tenant/models/tenant'
import User from '#modules/auth/models/user'

export default class TenantMembership extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare tenantId: string

  @column()
  declare userId: string

  @column()
  declare status: MembershipStatus

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
