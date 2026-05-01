import { DateTime } from 'luxon'
import { belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import type { JsonRecord, SourceType } from '#shared/types/model_enums'
import JudicialProcessMovementComplement from '#modules/precatorios/models/judicial_process_movement_complement'
import JudicialProcessSignal from '#modules/precatorios/models/judicial_process_signal'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import SourceRecord from '#modules/siop/models/source_record'
import Tenant from '#modules/tenant/models/tenant'

export default class JudicialProcessMovement extends TenantModel {
  @column()
  declare processId: string

  @column()
  declare sourceRecordId: string | null

  @column()
  declare source: SourceType

  @column()
  declare movementCode: number | null

  @column()
  declare movementName: string

  @column.dateTime()
  declare occurredAt: DateTime | null

  @column()
  declare sequence: number | null

  @column()
  declare judgingBodyCode: string | null

  @column()
  declare judgingBodyName: string | null

  @column()
  declare judgingBodyMunicipalityIbgeCode: number | null

  @column()
  declare rawData: JsonRecord | null

  @column()
  declare idempotencyKey: string

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => JudicialProcess, {
    foreignKey: 'processId',
  })
  declare process: BelongsTo<typeof JudicialProcess>

  @belongsTo(() => SourceRecord)
  declare sourceRecord: BelongsTo<typeof SourceRecord>

  @hasMany(() => JudicialProcessMovementComplement, {
    foreignKey: 'movementId',
  })
  declare complements: HasMany<typeof JudicialProcessMovementComplement>

  @hasMany(() => JudicialProcessSignal, {
    foreignKey: 'movementId',
  })
  declare signals: HasMany<typeof JudicialProcessSignal>
}
