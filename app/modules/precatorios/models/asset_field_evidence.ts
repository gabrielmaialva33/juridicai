import { DateTime } from 'luxon'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import type { JsonRecord, SourceType } from '#shared/types/model_enums'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import SourceDataset from '#modules/integrations/models/source_dataset'
import SourceRecord from '#modules/siop/models/source_record'

export type AssetFieldEvidenceStatus = 'resolved' | 'conflict' | 'missing'

export default class AssetFieldEvidence extends TenantModel {
  @column()
  declare assetId: string

  @column()
  declare fieldKey: string

  @column()
  declare canonicalValue: string | null

  @column()
  declare canonicalSource: SourceType | null

  @column()
  declare canonicalSourceRecordId: string | null

  @column()
  declare canonicalSourceDatasetId: string | null

  @column()
  declare confidence: string

  @column()
  declare status: AssetFieldEvidenceStatus

  @column()
  declare evidenceCount: number

  @column({
    prepare: (value) => JSON.stringify(value ?? []),
  })
  declare conflictingValues: JsonRecord[]

  @column({
    prepare: (value) => JSON.stringify(value ?? []),
  })
  declare evidence: JsonRecord[]

  @column.dateTime()
  declare computedAt: DateTime

  @belongsTo(() => PrecatorioAsset, {
    foreignKey: 'assetId',
  })
  declare asset: BelongsTo<typeof PrecatorioAsset>

  @belongsTo(() => SourceRecord, {
    foreignKey: 'canonicalSourceRecordId',
  })
  declare canonicalSourceRecord: BelongsTo<typeof SourceRecord>

  @belongsTo(() => SourceDataset, {
    foreignKey: 'canonicalSourceDatasetId',
  })
  declare canonicalSourceDataset: BelongsTo<typeof SourceDataset>
}
