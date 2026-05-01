import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import type { ExternalIdentifierType, JsonRecord } from '#shared/types/model_enums'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import SourceDataset from '#modules/integrations/models/source_dataset'
import SourceRecord from '#modules/siop/models/source_record'

export default class ExternalIdentifier extends TenantModel {
  @column()
  declare assetId: string

  @column()
  declare sourceRecordId: string | null

  @column()
  declare sourceDatasetId: string | null

  @column()
  declare identifierType: ExternalIdentifierType

  @column()
  declare identifierValue: string

  @column()
  declare normalizedValue: string

  @column()
  declare issuer: string | null

  @column()
  declare confidence: string

  @column()
  declare isPrimary: boolean

  @column()
  declare rawData: JsonRecord | null

  @belongsTo(() => PrecatorioAsset, {
    foreignKey: 'assetId',
  })
  declare asset: BelongsTo<typeof PrecatorioAsset>

  @belongsTo(() => SourceRecord)
  declare sourceRecord: BelongsTo<typeof SourceRecord>

  @belongsTo(() => SourceDataset)
  declare sourceDataset: BelongsTo<typeof SourceDataset>
}
