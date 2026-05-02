import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import BudgetUnit from '#modules/reference/models/budget_unit'
import Court from '#modules/reference/models/court'
import SourceDataset from '#modules/integrations/models/source_dataset'
import SourceRecord from '#modules/siop/models/source_record'
import type { JsonRecord } from '#shared/types/model_enums'

export default class TribunalBudgetExecution extends TenantModel {
  static table = 'tribunal_budget_executions'

  @column()
  declare sourceRecordId: string

  @column()
  declare sourceDatasetId: string | null

  @column()
  declare courtId: string | null

  @column()
  declare budgetUnitId: string | null

  @column()
  declare courtAlias: string

  @column()
  declare sourceKind: string

  @column()
  declare referenceYear: number | null

  @column()
  declare referenceMonth: number | null

  @column()
  declare budgetUnitCode: string | null

  @column()
  declare budgetUnitName: string | null

  @column()
  declare functionSubfunction: string | null

  @column()
  declare programmaticCode: string | null

  @column()
  declare programName: string | null

  @column()
  declare actionName: string | null

  @column()
  declare sphereCode: string | null

  @column()
  declare fundingSourceCode: string | null

  @column()
  declare fundingSourceName: string | null

  @column()
  declare expenseGroupCode: string | null

  @column()
  declare initialAllocation: string | null

  @column()
  declare additionalCreditsIncrease: string | null

  @column()
  declare additionalCreditsDecrease: string | null

  @column()
  declare updatedAllocation: string | null

  @column()
  declare contingencyAmount: string | null

  @column()
  declare creditProvisionAmount: string | null

  @column()
  declare creditHighlightAmount: string | null

  @column()
  declare netAllocation: string | null

  @column()
  declare committedAmount: string | null

  @column()
  declare committedPercent: string | null

  @column()
  declare liquidatedAmount: string | null

  @column()
  declare liquidatedPercent: string | null

  @column()
  declare paidAmount: string | null

  @column()
  declare paidPercent: string | null

  @column()
  declare rowFingerprint: string

  @column()
  declare rawData: JsonRecord | null

  @belongsTo(() => SourceRecord)
  declare sourceRecord: BelongsTo<typeof SourceRecord>

  @belongsTo(() => SourceDataset)
  declare sourceDataset: BelongsTo<typeof SourceDataset>

  @belongsTo(() => Court)
  declare court: BelongsTo<typeof Court>

  @belongsTo(() => BudgetUnit)
  declare budgetUnit: BelongsTo<typeof BudgetUnit>
}
