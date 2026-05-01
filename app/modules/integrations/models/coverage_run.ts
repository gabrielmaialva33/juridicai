import { DateTime } from 'luxon'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import type { JobRunOrigin, JobRunStatus, JsonRecord } from '#shared/types/model_enums'
import SourceDataset from '#modules/integrations/models/source_dataset'
import SourceRecord from '#modules/siop/models/source_record'

export default class CoverageRun extends TenantModel {
  @column()
  declare sourceDatasetId: string | null

  @column()
  declare sourceRecordId: string | null

  @column()
  declare status: JobRunStatus

  @column()
  declare origin: JobRunOrigin

  @column()
  declare scope: JsonRecord | null

  @column.dateTime()
  declare startedAt: DateTime | null

  @column.dateTime()
  declare finishedAt: DateTime | null

  @column()
  declare discoveredCount: number

  @column()
  declare sourceRecordsCount: number

  @column()
  declare createdAssetsCount: number

  @column()
  declare linkedAssetsCount: number

  @column()
  declare enrichedAssetsCount: number

  @column()
  declare errorCount: number

  @column()
  declare metrics: JsonRecord | null

  @column()
  declare errorMessage: string | null

  @belongsTo(() => SourceDataset)
  declare sourceDataset: BelongsTo<typeof SourceDataset>

  @belongsTo(() => SourceRecord)
  declare sourceRecord: BelongsTo<typeof SourceRecord>
}
