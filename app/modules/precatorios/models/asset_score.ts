import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { JsonRecord } from '#shared/types/model_enums'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import Tenant from '#modules/tenant/models/tenant'

export default class AssetScore extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare tenantId: string

  @column()
  declare assetId: string

  @column()
  declare scoreVersion: string

  @column()
  declare dataQualityScore: number | null

  @column()
  declare maturityScore: number | null

  @column()
  declare liquidityScore: number | null

  @column()
  declare legalSignalScore: number | null

  @column()
  declare economicScore: number | null

  @column()
  declare riskScore: number | null

  @column()
  declare finalScore: number | null

  @column()
  declare explanation: JsonRecord | null

  @column.dateTime({ autoCreate: true })
  declare computedAt: DateTime

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => PrecatorioAsset, {
    foreignKey: 'assetId',
  })
  declare asset: BelongsTo<typeof PrecatorioAsset>
}
