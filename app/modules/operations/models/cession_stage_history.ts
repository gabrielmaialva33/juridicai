import { DateTime } from 'luxon'
import TenantModel from '#shared/models/tenant_model'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import CessionOpportunity, {
  type CessionPipelineStage,
} from '#modules/operations/models/cession_opportunity'
import User from '#modules/auth/models/user'

export default class CessionStageHistory extends TenantModel {
  static table = 'cession_stage_history'

  @column()
  declare opportunityId: string

  @column()
  declare fromStage: CessionPipelineStage | null

  @column()
  declare toStage: CessionPipelineStage

  @column()
  declare changedByUserId: string | null

  @column()
  declare reason: string | null

  @column.dateTime()
  declare changedAt: DateTime

  @belongsTo(() => CessionOpportunity, {
    foreignKey: 'opportunityId',
  })
  declare opportunity: BelongsTo<typeof CessionOpportunity>

  @belongsTo(() => User, {
    foreignKey: 'changedByUserId',
  })
  declare changedByUser: BelongsTo<typeof User>
}
