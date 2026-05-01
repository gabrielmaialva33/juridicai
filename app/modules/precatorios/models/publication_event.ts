import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { JsonRecord } from '#shared/types/model_enums'
import Publication from '#modules/precatorios/models/publication'
import Tenant from '#modules/tenant/models/tenant'

export default class PublicationEvent extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare tenantId: string

  @column()
  declare publicationId: string

  @column()
  declare eventType: string

  @column.dateTime({ autoCreate: true })
  declare eventDate: DateTime

  @column()
  declare payload: JsonRecord | null

  @column()
  declare idempotencyKey: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => Publication)
  declare publication: BelongsTo<typeof Publication>
}
