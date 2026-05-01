import { DateTime } from 'luxon'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import type { JsonRecord } from '#shared/types/model_enums'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import Tenant from '#modules/tenant/models/tenant'
import User from '#modules/auth/models/user'

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
  declare stage: CessionPipelineStage

  @column()
  declare offerRate: string | null

  @column()
  declare offerValue: string | null

  @column()
  declare termMonths: number | null

  @column()
  declare expectedAnnualIrr: string | null

  @column()
  declare riskAdjustedIrr: string | null

  @column()
  declare paymentProbability: string | null

  @column()
  declare finalScore: string | null

  @column()
  declare grade: OpportunityGrade | null

  @column()
  declare priority: number

  @column.dateTime()
  declare targetCloseAt: DateTime | null

  @column.dateTime()
  declare lastContactedAt: DateTime | null

  @column()
  declare pricingSnapshot: JsonRecord | null

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

  @belongsTo(() => User, {
    foreignKey: 'createdByUserId',
  })
  declare createdByUser: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'updatedByUserId',
  })
  declare updatedByUser: BelongsTo<typeof User>
}
