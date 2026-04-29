import { DateTime } from 'luxon'
import { belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import TenantBaseModel from '#shared/models/tenant_base_model'
import type { ImportStatus, JsonRecord, SourceType } from '#shared/types/model_enums'
import SourceRecord from '#modules/siop/models/source_record'
import SiopStagingRow from '#modules/siop/models/siop_staging_row'
import Tenant from '#modules/tenant/models/tenant'
import User from '#modules/auth/models/user'

export default class SiopImport extends TenantBaseModel {
  @column()
  declare exerciseYear: number

  @column()
  declare sourceRecordId: string

  @column()
  declare source: SourceType

  @column()
  declare status: ImportStatus

  @column.dateTime()
  declare startedAt: DateTime | null

  @column.dateTime()
  declare finishedAt: DateTime | null

  @column()
  declare totalRows: number

  @column()
  declare inserted: number

  @column()
  declare updated: number

  @column()
  declare skipped: number

  @column()
  declare errors: number

  @column()
  declare rawMetadata: JsonRecord | null

  @column()
  declare uploadedByUserId: string | null

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => SourceRecord)
  declare sourceRecord: BelongsTo<typeof SourceRecord>

  @belongsTo(() => User, {
    foreignKey: 'uploadedByUserId',
  })
  declare uploadedBy: BelongsTo<typeof User>

  @hasMany(() => SiopStagingRow, {
    foreignKey: 'importId',
  })
  declare stagingRows: HasMany<typeof SiopStagingRow>
}
