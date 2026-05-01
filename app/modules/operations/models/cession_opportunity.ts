import { DateTime } from 'luxon'
import { belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import type { JsonRecord } from '#shared/types/model_enums'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import Tenant from '#modules/tenant/models/tenant'
import User from '#modules/auth/models/user'
import CessionPricing from '#modules/operations/models/cession_pricing'
import CessionStageHistory from '#modules/operations/models/cession_stage_history'

export type CessionPipelineStage =
  | 'inbox'
  | 'qualified'
  | 'contact'
  | 'offer'
  | 'due_diligence'
  | 'cession'
  | 'paid'
  | 'lost'

export type OpportunityGrade = 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D'

export default class CessionOpportunity extends TenantModel {
  @column()
  declare assetId: string

  @column()
  declare currentPricingId: string | null

  @column()
  declare stage: CessionPipelineStage

  @column()
  declare grade: OpportunityGrade | null

  @column()
  declare priority: number

  @column.dateTime()
  declare targetCloseAt: DateTime | null

  @column.dateTime()
  declare lastContactedAt: DateTime | null

  @column()
  declare metadata: JsonRecord | null

  @column()
  declare notes: string | null

  @column()
  declare createdByUserId: string | null

  @column()
  declare updatedByUserId: string | null

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => PrecatorioAsset, {
    foreignKey: 'assetId',
  })
  declare asset: BelongsTo<typeof PrecatorioAsset>

  @belongsTo(() => CessionPricing, {
    foreignKey: 'currentPricingId',
  })
  declare currentPricing: BelongsTo<typeof CessionPricing>

  @belongsTo(() => User, {
    foreignKey: 'createdByUserId',
  })
  declare createdByUser: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'updatedByUserId',
  })
  declare updatedByUser: BelongsTo<typeof User>

  @hasMany(() => CessionPricing, {
    foreignKey: 'opportunityId',
  })
  declare pricings: HasMany<typeof CessionPricing>

  @hasMany(() => CessionStageHistory, {
    foreignKey: 'opportunityId',
  })
  declare stageHistory: HasMany<typeof CessionStageHistory>
}
