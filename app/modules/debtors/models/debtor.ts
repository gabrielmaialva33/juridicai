import { belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import TenantBaseModel from '#shared/models/tenant_base_model'
import type { DebtorType, PaymentRegime } from '#shared/types/model_enums'
import Tenant from '#modules/tenant/models/tenant'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import DebtorPaymentStat from '#modules/debtors/models/debtor_payment_stat'

export default class Debtor extends TenantBaseModel {
  @column()
  declare name: string

  @column()
  declare normalizedName: string

  @column()
  declare normalizedKey: string

  @column()
  declare debtorType: DebtorType

  @column()
  declare cnpj: string | null

  @column()
  declare stateCode: string | null

  @column()
  declare paymentRegime: PaymentRegime | null

  @column()
  declare rclEstimate: string | null

  @column()
  declare debtStockEstimate: string | null

  @column()
  declare paymentReliabilityScore: number | null

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @hasMany(() => PrecatorioAsset)
  declare assets: HasMany<typeof PrecatorioAsset>

  @hasMany(() => DebtorPaymentStat, {
    foreignKey: 'debtorId',
  })
  declare paymentStats: HasMany<typeof DebtorPaymentStat>
}
