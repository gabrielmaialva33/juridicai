import BaseRepository from '#shared/repositories/base_repository'
import AssetBudgetFact from '#modules/precatorios/models/asset_budget_fact'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

class AssetBudgetFactRepository extends BaseRepository<typeof AssetBudgetFact> {
  constructor() {
    super(AssetBudgetFact)
  }

  async upsertForSiopImport(
    tenantId: string,
    input: {
      assetId: string
      sourceRecordId: string
      exerciseYear: number | null
      budgetYear: number | null
      budgetUnitId: string | null
      expenseType: string | null
      causeType: string | null
      natureExpenseCode: string | null
      valueRange: string | null
      taxClaim: boolean | null
      fundef: boolean | null
      elapsedYears: number | null
      elapsedYearsClass: string | null
      rawData: Record<string, unknown>
    },
    trx: TransactionClientContract
  ) {
    const query = AssetBudgetFact.query({ client: trx })
      .where('tenant_id', tenantId)
      .where('asset_id', input.assetId)
      .where('source_record_id', input.sourceRecordId)

    if (input.exerciseYear) {
      query.where('exercise_year', input.exerciseYear)
    } else {
      query.whereNull('exercise_year')
    }

    if (input.budgetYear) {
      query.where('budget_year', input.budgetYear)
    } else {
      query.whereNull('budget_year')
    }

    const existing = await query.first()
    const payload = { tenantId, ...input }

    if (existing) {
      existing.useTransaction(trx)
      existing.merge(payload)
      await existing.save()
      return existing
    }

    return AssetBudgetFact.create(payload, { client: trx })
  }
}

export default new AssetBudgetFactRepository()
