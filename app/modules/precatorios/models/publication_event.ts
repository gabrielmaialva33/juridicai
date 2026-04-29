import { DateTime } from 'luxon'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import type { JsonRecord } from '#shared/types/model_enums'
import Publication from '#modules/precatorios/models/publication'
import Tenant from '#modules/tenant/models/tenant'

export default class PublicationEvent extends TenantModel {
  @column()
  declare publicationId: string

  @column()
  declare eventType: string

  @column.dateTime({ autoCreate: true })
  declare eventDate: DateTime

  @column()
  declare payload: JsonRecord | null

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => Publication)
  declare publication: BelongsTo<typeof Publication>
}
