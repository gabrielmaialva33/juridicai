import type TribunalBudgetExecution from '#modules/integrations/models/tribunal_budget_execution'
import tribunalBudgetExecutionRepository from '#modules/integrations/repositories/tribunal_budget_execution_repository'

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
    const [executions, summary] = await Promise.all([
      tribunalBudgetExecutionRepository.list(tenantId, filters),
      this.summary(tenantId, filters),
    ])

    return {
      executions,
      summary,
    }
  }

  async summary(tenantId: string, filters: TribunalBudgetExecutionFilters) {
    const row = await tribunalBudgetExecutionRepository.summary(tenantId, filters)

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
