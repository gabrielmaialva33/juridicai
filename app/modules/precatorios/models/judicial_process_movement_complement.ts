import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import type { JsonRecord } from '#shared/types/model_enums'
import JudicialProcessMovement from '#modules/precatorios/models/judicial_process_movement'
import SourceRecord from '#modules/siop/models/source_record'
import Tenant from '#modules/tenant/models/tenant'
import MovementComplementType from '#modules/reference/models/movement_complement_type'

export default class JudicialProcessMovementComplement extends TenantModel {
  @column()
  declare movementId: string

  @column()
  declare sourceRecordId: string | null

  @column()
  declare complementTypeId: string | null

  @column()
  declare complementCode: number | null

  @column()
  declare complementValue: number | null

  @column()
  declare complementName: string | null

  @column()
  declare complementDescription: string | null

  @column()
  declare sequence: number | null

  @column()
  declare rawData: JsonRecord | null

  @column()
  declare idempotencyKey: string

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => JudicialProcessMovement, {
    foreignKey: 'movementId',
  })
  declare movement: BelongsTo<typeof JudicialProcessMovement>

  @belongsTo(() => SourceRecord)
  declare sourceRecord: BelongsTo<typeof SourceRecord>

  @belongsTo(() => MovementComplementType, {
    foreignKey: 'complementTypeId',
  })
  declare complementType: BelongsTo<typeof MovementComplementType>
}
