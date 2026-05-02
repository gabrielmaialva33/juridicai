import db from '@adonisjs/lucid/services/db'
import TribunalBudgetExecution from '#modules/integrations/models/tribunal_budget_execution'

export type TribunalBudgetExecutionFilters = {
  page: number
  limit: number
  courtAlias: string | null
  sourceKind: string | null
  referenceYear: number | null
  referenceMonth: number | null
  budgetUnitCode: string | null
  q: string | null
  sortBy: TribunalBudgetExecutionSortBy
  sortDirection: 'asc' | 'desc'
}

export type TribunalBudgetExecutionSortBy =
  | 'reference_period'
  | 'budget_unit_code'
  | 'net_allocation'
  | 'committed_amount'
  | 'paid_amount'
  | 'created_at'

class TribunalBudgetExecutionService {
  async list(tenantId: string, filters: TribunalBudgetExecutionFilters) {
    const query = TribunalBudgetExecution.query()
      .where('tenant_id', tenantId)
      .preload('sourceRecord')
      .preload('court')
      .preload('budgetUnit')

    applyFilters(query, filters)
    applySorting(query, filters)

    const [executions, summary] = await Promise.all([
      query.paginate(filters.page, filters.limit),
      this.summary(tenantId, filters),
    ])

    return {
      executions,
      summary,
    }
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

    return {
      rowsCount: Number(row.rows_count ?? 0),
      netAllocationTotal: decimalString(row.net_allocation_total),
      committedAmountTotal: decimalString(row.committed_amount_total),
      liquidatedAmountTotal: decimalString(row.liquidated_amount_total),
      paidAmountTotal: decimalString(row.paid_amount_total),
    }
  }
}

export function serializeTribunalBudgetExecution(execution: TribunalBudgetExecution) {
  return {
    id: execution.id,
    tenantId: execution.tenantId,
    sourceRecordId: execution.sourceRecordId,
    sourceDatasetId: execution.sourceDatasetId,
    courtId: execution.courtId,
    courtAlias: execution.courtAlias,
    sourceKind: execution.sourceKind,
    referenceYear: execution.referenceYear,
    referenceMonth: execution.referenceMonth,
    budgetUnitId: execution.budgetUnitId,
    budgetUnitCode: execution.budgetUnitCode,
    budgetUnitName: execution.budgetUnitName,
    functionSubfunction: execution.functionSubfunction,
    programmaticCode: execution.programmaticCode,
    programName: execution.programName,
    actionName: execution.actionName,
    sphereCode: execution.sphereCode,
    fundingSourceCode: execution.fundingSourceCode,
    fundingSourceName: execution.fundingSourceName,
    expenseGroupCode: execution.expenseGroupCode,
    initialAllocation: execution.initialAllocation,
    additionalCreditsIncrease: execution.additionalCreditsIncrease,
    additionalCreditsDecrease: execution.additionalCreditsDecrease,
    updatedAllocation: execution.updatedAllocation,
    contingencyAmount: execution.contingencyAmount,
    creditProvisionAmount: execution.creditProvisionAmount,
    creditHighlightAmount: execution.creditHighlightAmount,
    netAllocation: execution.netAllocation,
    committedAmount: execution.committedAmount,
    committedPercent: execution.committedPercent,
    liquidatedAmount: execution.liquidatedAmount,
    liquidatedPercent: execution.liquidatedPercent,
    paidAmount: execution.paidAmount,
    paidPercent: execution.paidPercent,
    sourceRecord: execution.sourceRecord
      ? {
          id: execution.sourceRecord.id,
          sourceUrl: execution.sourceRecord.sourceUrl,
          originalFilename: execution.sourceRecord.originalFilename,
          collectedAt: execution.sourceRecord.collectedAt?.toISO() ?? null,
        }
      : null,
    court: execution.court
      ? {
          id: execution.court.id,
          code: execution.court.code,
          alias: execution.court.alias,
          name: execution.court.name,
        }
      : null,
    createdAt: execution.createdAt.toISO(),
    updatedAt: execution.updatedAt.toISO(),
  }
}

function applyFilters(
  query: ReturnType<typeof TribunalBudgetExecution.query>,
  filters: TribunalBudgetExecutionFilters
) {
  if (filters.courtAlias) {
    query.where('court_alias', filters.courtAlias)
  }

  if (filters.sourceKind) {
    query.where('source_kind', filters.sourceKind)
  }

  if (filters.referenceYear !== null) {
    query.where('reference_year', filters.referenceYear)
  }

  if (filters.referenceMonth !== null) {
    query.where('reference_month', filters.referenceMonth)
  }

  if (filters.budgetUnitCode) {
    query.where('budget_unit_code', filters.budgetUnitCode)
  }

  if (filters.q) {
    const like = `%${filters.q}%`
    query.where((builder) => {
      builder
        .whereILike('budget_unit_name', like)
        .orWhereILike('program_name', like)
        .orWhereILike('action_name', like)
        .orWhereILike('funding_source_name', like)
    })
  }
}

function applyRawFilters(
  query: ReturnType<typeof db.from>,
  filters: TribunalBudgetExecutionFilters
) {
  if (filters.courtAlias) {
    query.where('court_alias', filters.courtAlias)
  }

  if (filters.sourceKind) {
    query.where('source_kind', filters.sourceKind)
  }

  if (filters.referenceYear !== null) {
    query.where('reference_year', filters.referenceYear)
  }

  if (filters.referenceMonth !== null) {
    query.where('reference_month', filters.referenceMonth)
  }

  if (filters.budgetUnitCode) {
    query.where('budget_unit_code', filters.budgetUnitCode)
  }

  if (filters.q) {
    const like = `%${filters.q}%`
    query.where((builder) => {
      builder
        .whereILike('budget_unit_name', like)
        .orWhereILike('program_name', like)
        .orWhereILike('action_name', like)
        .orWhereILike('funding_source_name', like)
    })
  }
}

function applySorting(
  query: ReturnType<typeof TribunalBudgetExecution.query>,
  filters: TribunalBudgetExecutionFilters
) {
  if (filters.sortBy === 'reference_period') {
    query
      .orderBy('reference_year', filters.sortDirection)
      .orderBy('reference_month', filters.sortDirection)
      .orderBy('budget_unit_code', 'asc')
    return
  }

  query.orderBy(filters.sortBy, filters.sortDirection).orderBy('id', 'asc')
}

function decimalString(value: unknown) {
  if (value === null || value === undefined) {
    return '0.00'
  }

  const text = String(value).trim()
  if (!text) {
    return '0.00'
  }

  const [integer, fraction = ''] = text.split('.')
  return `${integer}.${fraction.padEnd(2, '0').slice(0, 2)}`
}

export default new TribunalBudgetExecutionService()
