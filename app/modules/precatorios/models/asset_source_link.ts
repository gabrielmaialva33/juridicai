import { DateTime } from 'luxon'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import type { AssetSourceLinkType, JsonRecord } from '#shared/types/model_enums'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import SourceDataset from '#modules/integrations/models/source_dataset'
import SourceRecord from '#modules/siop/models/source_record'

export default class AssetSourceLink extends TenantModel {
  @column()
  declare assetId: string

  @column()
  declare sourceRecordId: string

  @column()
  declare sourceDatasetId: string | null

  @column()
  declare linkType: AssetSourceLinkType

  @column()
  declare confidence: string

  @column()
  declare matchReason: string | null

  @column()
  declare matchedFields: JsonRecord | null

  @column()
  declare normalizedPayload: JsonRecord | null

  @column()
  declare rawPointer: JsonRecord | null

  @column.dateTime({ autoCreate: true })
  declare firstSeenAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare lastSeenAt: DateTime

  @belongsTo(() => PrecatorioAsset, {
    foreignKey: 'assetId',
  })
  declare asset: BelongsTo<typeof PrecatorioAsset>

  @belongsTo(() => SourceRecord)
  declare sourceRecord: BelongsTo<typeof SourceRecord>

  @belongsTo(() => SourceDataset)
  declare sourceDataset: BelongsTo<typeof SourceDataset>
}
