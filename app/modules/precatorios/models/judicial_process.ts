import { DateTime } from 'luxon'
import { belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import TenantBaseModel from '#shared/models/tenant_base_model'
import type { JsonRecord, SourceType } from '#shared/types/model_enums'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import Publication from '#modules/precatorios/models/publication'
import SourceRecord from '#modules/siop/models/source_record'
import Tenant from '#modules/tenant/models/tenant'

export default class JudicialProcess extends TenantBaseModel {
  @column()
  declare assetId: string | null

  @column()
  declare sourceRecordId: string | null

  @column()
  declare source: SourceType

  @column()
  declare cnjNumber: string

  @column()
  declare courtCode: string | null

  @column()
  declare courtName: string | null

  @column()
  declare className: string | null

  @column()
  declare subject: string | null

  @column.date()
  declare filedAt: DateTime | null

  @column()
  declare rawData: JsonRecord | null

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => PrecatorioAsset, {
    foreignKey: 'assetId',
  })
  declare asset: BelongsTo<typeof PrecatorioAsset>

  @belongsTo(() => SourceRecord)
  declare sourceRecord: BelongsTo<typeof SourceRecord>

  @hasMany(() => Publication, {
    foreignKey: 'processId',
  })
  declare publications: HasMany<typeof Publication>
}
