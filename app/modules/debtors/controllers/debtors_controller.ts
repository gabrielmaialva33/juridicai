import debtorService from '#modules/debtors/services/debtor_service'
import tenantContext from '#shared/helpers/tenant_context'
import {
  boundedLimit,
  enumOrNull,
  positiveInteger,
  stateCodeOrNull,
  stringOrNull,
} from '#shared/helpers/request_filters'
import type { DebtorListFilters } from '#modules/debtors/repositories/debtor_repository'
import type { HttpContext } from '@adonisjs/core/http'

export default class DebtorsController {
  async index({ request, response }: HttpContext) {
    const filters = normalizeFilters(request.qs())
    const debtors = await debtorService.list(tenantContext.requireTenantId(), filters)

    return response.ok({
      debtors: debtors.serialize(),
      filters,
    })
  }

  async show({ params, response }: HttpContext) {
    const debtor = await debtorService.show(tenantContext.requireTenantId(), params.id)

    return response.ok({
      debtor: debtor.serialize(),
    })
  }
}

function normalizeFilters(query: Record<string, unknown>): DebtorListFilters {
  return {
    page: positiveInteger(query.page, 1),
    limit: boundedLimit(query.limit),
    q: stringOrNull(query.q),
    debtorType: enumOrNull(query.debtorType, [
      'union',
      'state',
      'municipality',
      'autarchy',
      'foundation',
    ]),
    stateCode: stateCodeOrNull(query.stateCode),
    paymentRegime: enumOrNull(query.paymentRegime, ['none', 'special', 'federal_unique', 'other']),
    sortBy: enumOrNull(query.sortBy, ['name', 'payment_reliability_score', 'created_at']) ?? 'name',
    sortDirection: enumOrNull(query.sortDirection, ['asc', 'desc']) ?? 'asc',
  }
}
