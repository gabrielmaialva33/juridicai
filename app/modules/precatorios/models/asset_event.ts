import { DateTime } from 'luxon'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import type { JsonRecord, SourceType } from '#shared/types/model_enums'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import Tenant from '#modules/tenant/models/tenant'

export default class AssetEvent extends TenantModel {
  @column()
  declare assetId: string

  @column()
  declare eventType: string

  @column.dateTime({ autoCreate: true })
  declare eventDate: DateTime

  @column()
  declare source: SourceType | null

  @column()
  declare payload: JsonRecord | null

  @column()
  declare idempotencyKey: string

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => PrecatorioAsset, {
    foreignKey: 'assetId',
  })
  declare asset: BelongsTo<typeof PrecatorioAsset>
}
