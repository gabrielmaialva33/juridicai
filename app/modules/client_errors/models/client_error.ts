import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { ClientErrorStatus, JsonRecord } from '#shared/types/model_enums'
import Tenant from '#modules/tenant/models/tenant'
import User from '#modules/auth/models/user'

export default class ClientError extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare tenantId: string | null

  @column()
  declare userId: string | null

  @column()
  declare status: ClientErrorStatus

  @column()
  declare message: string

  @column()
  declare stackHash: string | null

  @column()
  declare url: string | null

  @column()
  declare userAgent: string | null

  @column()
  declare payload: JsonRecord | null

  @column()
  declare requestId: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
