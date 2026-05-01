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
import Court from '#modules/reference/models/court'
import JudgingBody from '#modules/reference/models/judging_body'
import JudicialClass from '#modules/reference/models/judicial_class'
import JudicialSystem from '#modules/reference/models/judicial_system'
import ProcessFormat from '#modules/reference/models/process_format'

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
  declare courtId: string | null

  @column()
  declare systemId: string | null

  @column()
  declare formatId: string | null

  @column()
  declare classId: string | null

  @column()
  declare judgingBodyId: string | null

  @column()
  declare courtAlias: string | null

  @column()
  declare degree: string | null

  @column()
  declare secrecyLevel: number | null

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

  @belongsTo(() => Court)
  declare court: BelongsTo<typeof Court>

  @belongsTo(() => JudicialSystem, {
    foreignKey: 'systemId',
  })
  declare judicialSystem: BelongsTo<typeof JudicialSystem>

  @belongsTo(() => ProcessFormat, {
    foreignKey: 'formatId',
  })
  declare format: BelongsTo<typeof ProcessFormat>

  @belongsTo(() => JudicialClass, {
    foreignKey: 'classId',
  })
  declare judicialClass: BelongsTo<typeof JudicialClass>

  @belongsTo(() => JudgingBody, {
    foreignKey: 'judgingBodyId',
  })
  declare judgingBody: BelongsTo<typeof JudgingBody>

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
