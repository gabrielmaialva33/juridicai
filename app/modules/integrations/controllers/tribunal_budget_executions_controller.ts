import tribunalBudgetExecutionService, {
  serializeTribunalBudgetExecution,
  type TribunalBudgetExecutionFilters,
} from '#modules/integrations/services/tribunal_budget_execution_service'
import tenantContext from '#shared/helpers/tenant_context'
import {
  boundedLimit,
  enumOrNull,
  numberOrNull,
  positiveInteger,
  stringOrNull,
} from '#shared/helpers/request_filters'
import type { HttpContext } from '@adonisjs/core/http'

export default class TribunalBudgetExecutionsController {
  async index({ request, response }: HttpContext) {
    const filters = normalizeFilters(request.qs())
    const result = await tribunalBudgetExecutionService.list(
      tenantContext.requireTenantId(),
      filters
    )

    return response.ok({
      executions: result.executions
        .all()
        .map((execution) => serializeTribunalBudgetExecution(execution)),
      meta: result.executions.getMeta(),
      summary: result.summary,
      filters,
    })
  }
}

function normalizeFilters(query: Record<string, unknown>): TribunalBudgetExecutionFilters {
  return {
    page: positiveInteger(query.page, 1),
    limit: boundedLimit(query.limit),
    courtAlias: stringOrNull(query.courtAlias)?.toLowerCase() ?? null,
    sourceKind: stringOrNull(query.sourceKind),
    referenceYear: numberOrNull(query.referenceYear),
    referenceMonth: numberOrNull(query.referenceMonth),
    budgetUnitCode: stringOrNull(query.budgetUnitCode),
    q: stringOrNull(query.q),
    sortBy:
      enumOrNull(query.sortBy, [
        'reference_period',
        'budget_unit_code',
        'net_allocation',
        'committed_amount',
        'paid_amount',
        'created_at',
      ]) ?? 'reference_period',
    sortDirection: enumOrNull(query.sortDirection, ['asc', 'desc']) ?? 'desc',
  }
}
