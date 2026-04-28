import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class AccessLog extends BaseModel {
  static table = 'pii.access_logs'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare tenantId: string

  @column()
  declare userId: string | null

  @column()
  declare beneficiaryId: string | null

  @column()
  declare assetId: string | null

  @column()
  declare action: string

  @column()
  declare allowed: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
