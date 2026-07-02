import BudgetUnit from '#modules/reference/models/budget_unit'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

class BudgetUnitRepository {
  async findOrCreateByCode(
    input: {
      code: string
      name: string
    },
    trx: TransactionClientContract
  ) {
    const existing = await BudgetUnit.query({ client: trx }).where('code', input.code).first()

    if (existing) {
      existing.name = input.name
      await existing.save()
      return existing
    }

    return BudgetUnit.create(input, { client: trx })
  }
}

export default new BudgetUnitRepository()
