import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import type { JsonRecord, SourceType } from '#shared/types/model_enums'
import Tenant from '#modules/tenant/models/tenant'
import SiopImport from '#modules/siop/models/siop_import'
import SourceDataset from '#modules/integrations/models/source_dataset'

export default class SourceRecord extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare tenantId: string

  @column()
  declare sourceDatasetId: string | null

  @column()
  declare source: SourceType

  @column()
  declare sourceUrl: string | null

  @column()
  declare sourceFilePath: string | null

  @column()
  declare sourceChecksum: string | null

  @column()
  declare originalFilename: string | null

  @column()
  declare mimeType: string | null

  @column()
  declare fileSizeBytes: bigint | number | null

  @column.dateTime()
  declare collectedAt: DateTime

  @column()
  declare rawData: JsonRecord | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => SourceDataset)
  declare sourceDataset: BelongsTo<typeof SourceDataset>

  @hasMany(() => SiopImport)
  declare siopImports: HasMany<typeof SiopImport>
}
