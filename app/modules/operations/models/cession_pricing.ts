import { DateTime } from 'luxon'
import TenantModel from '#shared/models/tenant_model'
import type { JsonRecord } from '#shared/types/model_enums'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import CessionOpportunity from '#modules/operations/models/cession_opportunity'
import User from '#modules/auth/models/user'

export default class CessionPricing extends TenantModel {
  @column()
  declare opportunityId: string

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
  declare modelVersion: string | null

  @column()
  declare pricingSnapshot: JsonRecord | null

  @column.dateTime()
  declare computedAt: DateTime

  @column()
  declare createdByUserId: string | null

  @belongsTo(() => CessionOpportunity, {
    foreignKey: 'opportunityId',
  })
  declare opportunity: BelongsTo<typeof CessionOpportunity>

  @belongsTo(() => User, {
    foreignKey: 'createdByUserId',
  })
  declare createdByUser: BelongsTo<typeof User>
}
