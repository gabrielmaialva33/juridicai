import { DateTime } from 'luxon'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import type { JsonRecord, SourceType } from '#shared/types/model_enums'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import JudicialProcessMovement from '#modules/precatorios/models/judicial_process_movement'
import Tenant from '#modules/tenant/models/tenant'

export type JudicialSignalPolarity = 'positive' | 'negative' | 'neutral'

export default class JudicialProcessSignal extends TenantModel {
  @column()
  declare processId: string

  @column()
  declare movementId: string | null

  @column()
  declare signalCode: string

  @column()
  declare polarity: JudicialSignalPolarity

  @column()
  declare confidence: number

  @column.dateTime()
  declare detectedAt: DateTime

  @column()
  declare source: SourceType

  @column()
  declare evidence: JsonRecord | null

  @column()
  declare idempotencyKey: string

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => JudicialProcess, {
    foreignKey: 'processId',
  })
  declare process: BelongsTo<typeof JudicialProcess>

  @belongsTo(() => JudicialProcessMovement, {
    foreignKey: 'movementId',
  })
  declare movement: BelongsTo<typeof JudicialProcessMovement>
}
