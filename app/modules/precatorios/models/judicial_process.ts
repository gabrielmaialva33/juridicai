import { DateTime } from 'luxon'
import { belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import TenantBaseModel from '#shared/models/tenant_base_model'
import type { JsonRecord, SourceType } from '#shared/types/model_enums'
import JudicialProcessMovement from '#modules/precatorios/models/judicial_process_movement'
import JudicialProcessSignal from '#modules/precatorios/models/judicial_process_signal'
import JudicialProcessSubject from '#modules/precatorios/models/judicial_process_subject'
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
  declare datajudId: string | null

  @column()
  declare datajudIndex: string | null

  @column()
  declare courtAlias: string | null

  @column()
  declare courtCode: string | null

  @column()
  declare courtName: string | null

  @column()
  declare degree: string | null

  @column()
  declare secrecyLevel: number | null

  @column()
  declare systemCode: number | null

  @column()
  declare systemName: string | null

  @column()
  declare formatCode: number | null

  @column()
  declare formatName: string | null

  @column()
  declare classCode: number | null

  @column()
  declare className: string | null

  @column()
  declare subject: string | null

  @column()
  declare judgingBodyCode: string | null

  @column()
  declare judgingBodyName: string | null

  @column()
  declare judgingBodyMunicipalityIbgeCode: number | null

  @column.date()
  declare filedAt: DateTime | null

  @column.dateTime()
  declare datajudUpdatedAt: DateTime | null

  @column.dateTime()
  declare datajudIndexedAt: DateTime | null

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

  @hasMany(() => JudicialProcessSubject, {
    foreignKey: 'processId',
  })
  declare subjects: HasMany<typeof JudicialProcessSubject>

  @hasMany(() => JudicialProcessMovement, {
    foreignKey: 'processId',
  })
  declare movements: HasMany<typeof JudicialProcessMovement>

  @hasMany(() => JudicialProcessSignal, {
    foreignKey: 'processId',
  })
  declare signals: HasMany<typeof JudicialProcessSignal>
}
