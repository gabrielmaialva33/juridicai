import { DateTime } from 'luxon'
import TenantModel from '#shared/models/tenant_model'
import type { JsonRecord } from '#shared/types/model_enums'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import SourceRecord from '#modules/siop/models/source_record'

export default class AssetValuation extends TenantModel {
  @column()
  declare assetId: string

  @column()
  declare faceValue: string | null

  @column()
  declare estimatedUpdatedValue: string | null

  @column.date()
  declare baseDate: DateTime | null

  @column.date()
  declare correctionStartedAt: DateTime | null

  @column.date()
  declare correctionEndedAt: DateTime | null

  @column()
  declare correctionIndex: string | null

  @column()
  declare queuePosition: number | null

  @column()
  declare sourceRecordId: string | null

  @column.dateTime()
  declare computedAt: DateTime

  @column()
  declare rawData: JsonRecord | null

  @belongsTo(() => PrecatorioAsset, {
    foreignKey: 'assetId',
  })
  declare asset: BelongsTo<typeof PrecatorioAsset>

  @belongsTo(() => SourceRecord)
  declare sourceRecord: BelongsTo<typeof SourceRecord>
}
