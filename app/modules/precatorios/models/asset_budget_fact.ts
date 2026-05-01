import TenantModel from '#shared/models/tenant_model'
import type { JsonRecord } from '#shared/types/model_enums'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import BudgetUnit from '#modules/reference/models/budget_unit'
import SourceRecord from '#modules/siop/models/source_record'

export default class AssetBudgetFact extends TenantModel {
  @column()
  declare assetId: string

  @column()
  declare exerciseYear: number | null

  @column()
  declare budgetYear: number | null

  @column()
  declare budgetUnitId: string | null

  @column()
  declare expenseType: string | null

  @column()
  declare causeType: string | null

  @column()
  declare natureExpenseCode: string | null

  @column()
  declare valueRange: string | null

  @column()
  declare taxClaim: boolean | null

  @column()
  declare fundef: boolean | null

  @column()
  declare elapsedYears: number | null

  @column()
  declare elapsedYearsClass: string | null

  @column()
  declare sourceRecordId: string | null

  @column()
  declare rawData: JsonRecord | null

  @belongsTo(() => PrecatorioAsset, {
    foreignKey: 'assetId',
  })
  declare asset: BelongsTo<typeof PrecatorioAsset>

  @belongsTo(() => BudgetUnit)
  declare budgetUnit: BelongsTo<typeof BudgetUnit>

  @belongsTo(() => SourceRecord)
  declare sourceRecord: BelongsTo<typeof SourceRecord>
}
