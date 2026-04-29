import { DateTime } from 'luxon'
import { belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import type { JsonRecord, SourceType } from '#shared/types/model_enums'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import PublicationEvent from '#modules/precatorios/models/publication_event'
import SourceRecord from '#modules/siop/models/source_record'
import Tenant from '#modules/tenant/models/tenant'

export default class Publication extends TenantModel {
  @column()
  declare assetId: string | null

  @column()
  declare processId: string | null

  @column()
  declare sourceRecordId: string | null

  @column()
  declare source: SourceType

  @column.date()
  declare publicationDate: DateTime

  @column()
  declare title: string | null

  @column()
  declare body: string

  @column()
  declare textHash: string | null

  @column()
  declare rawData: JsonRecord | null

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => PrecatorioAsset, {
    foreignKey: 'assetId',
  })
  declare asset: BelongsTo<typeof PrecatorioAsset>

  @belongsTo(() => JudicialProcess, {
    foreignKey: 'processId',
  })
  declare process: BelongsTo<typeof JudicialProcess>

  @belongsTo(() => SourceRecord)
  declare sourceRecord: BelongsTo<typeof SourceRecord>

  @hasMany(() => PublicationEvent)
  declare events: HasMany<typeof PublicationEvent>
}
