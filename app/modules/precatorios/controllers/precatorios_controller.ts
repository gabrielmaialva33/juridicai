import precatorioService from '#modules/precatorios/services/precatorio_service'
import tenantContext from '#shared/helpers/tenant_context'
import {
  boundedLimit,
  enumOrNull,
  numberOrNull,
  positiveInteger,
  stringOrNull,
} from '#shared/helpers/request_filters'
import type { PrecatorioListFilters } from '#modules/precatorios/repositories/precatorio_repository'
import type { HttpContext } from '@adonisjs/core/http'

export default class PrecatoriosController {
  async index({ inertia, request }: HttpContext) {
    const filters = normalizeFilters(request.qs())
    const assets = await precatorioService.list(tenantContext.requireTenantId(), filters)

    return inertia.render('precatorios/index', {
      assets: assets.serialize() as any,
      filters: filters as any,
    })
  }

  async show({ inertia, params }: HttpContext) {
    const asset = await precatorioService.show(tenantContext.requireTenantId(), params.id)

    return inertia.render('precatorios/show', {
      asset: asset.serialize() as any,
    })
  }

  async timeline({ params, response }: HttpContext) {
    return response.ok(await precatorioService.timeline(tenantContext.requireTenantId(), params.id))
  }
}

function normalizeFilters(query: Record<string, unknown>): PrecatorioListFilters {
  return {
    page: positiveInteger(query.page, 1),
    limit: boundedLimit(query.limit),
    q: stringOrNull(query.q),
    debtorId: stringOrNull(query.debtorId),
    source: enumOrNull(query.source, [
      'siop',
      'datajud',
      'djen',
      'tribunal',
      'api_private',
      'manual',
    ]),
    nature: enumOrNull(query.nature, ['alimentar', 'comum', 'tributario', 'unknown']),
    lifecycleStatus: enumOrNull(query.lifecycleStatus, [
      'unknown',
      'discovered',
      'expedited',
      'pending',
      'in_payment',
      'paid',
      'cancelled',
      'suspended',
    ]),
    complianceStatus: enumOrNull(query.complianceStatus, [
      'pending',
      'approved_for_analysis',
      'approved_for_sales',
      'blocked',
      'opt_out',
    ]),
    exerciseYearFrom: numberOrNull(query.exerciseYearFrom),
    exerciseYearTo: numberOrNull(query.exerciseYearTo),
    minFaceValue: numberOrNull(query.minFaceValue),
    maxFaceValue: numberOrNull(query.maxFaceValue),
    sortBy:
      enumOrNull(query.sortBy, ['created_at', 'face_value', 'exercise_year', 'current_score']) ??
      'created_at',
    sortDirection: enumOrNull(query.sortDirection, ['asc', 'desc']) ?? 'desc',
  }
}
