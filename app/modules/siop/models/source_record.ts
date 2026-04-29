import { DateTime } from 'luxon'
import { belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import type { JsonRecord, SourceType } from '#shared/types/model_enums'
import Tenant from '#modules/tenant/models/tenant'
import SiopImport from '#modules/siop/models/siop_import'

export default class SourceRecord extends TenantModel {
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

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @hasMany(() => SiopImport)
  declare siopImports: HasMany<typeof SiopImport>
}
