import db from '@adonisjs/lucid/services/db'
import BaseRepository from '#shared/repositories/base_repository'
import TribunalBudgetExecution from '#modules/integrations/models/tribunal_budget_execution'
import type { TribunalBudgetExecutionFilters } from '#modules/integrations/services/tribunal_budget_execution_service'

class TribunalBudgetExecutionRepository extends BaseRepository<typeof TribunalBudgetExecution> {
  constructor() {
    super(TribunalBudgetExecution)
  }

  list(tenantId: string, filters: TribunalBudgetExecutionFilters) {
    const query = this.query(tenantId)
      .preload('sourceRecord')
      .preload('court')
      .preload('budgetUnit')

    applyFilters(query, filters)
    applySorting(query, filters)

    return query.paginate(filters.page, filters.limit)
  }

  async summary(tenantId: string, filters: TribunalBudgetExecutionFilters) {
    const query = db.from('tribunal_budget_executions').where('tenant_id', tenantId)

    applyRawFilters(query, filters)

    const [row] = await query
      .count('* as rows_count')
      .sum('net_allocation as net_allocation_total')
      .sum('committed_amount as committed_amount_total')
      .sum('liquidated_amount as liquidated_amount_total')
      .sum('paid_amount as paid_amount_total')

    return row
  }
}

function applyFilters(query: any, filters: TribunalBudgetExecutionFilters) {
  if (filters.courtAlias) query.where('court_alias', filters.courtAlias)
  if (filters.sourceKind) query.where('source_kind', filters.sourceKind)
  if (filters.referenceYear !== null) query.where('reference_year', filters.referenceYear)
  if (filters.referenceMonth !== null) query.where('reference_month', filters.referenceMonth)
  if (filters.budgetUnitCode) query.where('budget_unit_code', filters.budgetUnitCode)

  if (filters.q) {
    const pattern = `%${filters.q}%`
    query.where((builder: any) => {
      builder
        .whereILike('budget_unit_name', pattern)
        .orWhereILike('program_name', pattern)
        .orWhereILike('action_name', pattern)
        .orWhereILike('funding_source_name', pattern)
    })
  }
}

function applyRawFilters(query: any, filters: TribunalBudgetExecutionFilters) {
  applyFilters(query, filters)
}

function applySorting(query: any, filters: TribunalBudgetExecutionFilters) {
  if (filters.sortBy === 'reference_period') {
    query
      .orderBy('reference_year', filters.sortDirection)
      .orderBy('reference_month', filters.sortDirection)
    query.orderBy('budget_unit_code', 'asc')
    return
  }

  query.orderBy(filters.sortBy, filters.sortDirection).orderBy('id', 'asc')
}

export default new TribunalBudgetExecutionRepository()
