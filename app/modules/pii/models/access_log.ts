import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { JsonRecord, PiiAction } from '#shared/types/model_enums'

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
  declare action: PiiAction

  @column()
  declare reason: string | null

  @column()
  declare allowed: boolean

  @column()
  declare metadata: JsonRecord | null

  @column()
  declare requestId: string | null

  @column()
  declare ipAddress: string | null

  @column()
  declare userAgent: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
