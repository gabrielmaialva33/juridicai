import { DateTime } from 'luxon'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import type { JsonRecord } from '#shared/types/model_enums'
import Debtor from '#modules/debtors/models/debtor'
import Tenant from '#modules/tenant/models/tenant'

export default class DebtorPaymentStat extends TenantModel {
  @column()
  declare debtorId: string

  @column.date()
  declare periodStart: DateTime | null

  @column.date()
  declare periodEnd: DateTime | null

  @column()
  declare sampleSize: number

  @column()
  declare averagePaymentMonths: number | null

  @column()
  declare onTimePaymentRate: string | null

  @column()
  declare paidVolume: string | null

  @column()
  declare openDebtStock: string | null

  @column()
  declare rclDebtRatio: string | null

  @column()
  declare regimeSpecialActive: boolean

  @column()
  declare recentDefault: boolean

  @column()
  declare reliabilityScore: number | null

  @column()
  declare source: string

  @column()
  declare rawData: JsonRecord | null

  @column.dateTime({ autoCreate: true })
  declare computedAt: DateTime

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => Debtor, {
    foreignKey: 'debtorId',
  })
  declare debtor: BelongsTo<typeof Debtor>
}
