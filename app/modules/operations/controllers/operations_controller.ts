import { DateTime } from 'luxon'
import operationsService, {
  type OpportunityListFilters,
  type PipelineUpdateInput,
} from '#modules/operations/services/operations_service'
import type {
  CessionPipelineStage,
  OpportunityGrade,
} from '#modules/operations/models/cession_opportunity'
import tenantContext from '#shared/helpers/tenant_context'
import {
  boundedLimit,
  enumOrNull,
  numberOrNull,
  positiveInteger,
  stringOrNull,
} from '#shared/helpers/request_filters'
import type { PricingInput } from '#modules/operations/services/cession_pricing_engine'
import type { HttpContext } from '@adonisjs/core/http'

const PIPELINE_STAGES: CessionPipelineStage[] = [
  'inbox',
  'qualified',
  'contact',
  'offer',
  'due_diligence',
  'cession',
  'paid',
  'lost',
]

const GRADES: OpportunityGrade[] = ['A+', 'A', 'B+', 'B', 'C', 'D']

export default class OperationsController {
  async desk({ inertia }: HttpContext) {
    const data = await operationsService.desk(tenantContext.requireTenantId())
    return inertia.render('operations/desk', data as any)
  }

  async opportunities({ inertia, request }: HttpContext) {
    const filters = normalizeListFilters(request.qs())
    const data = await operationsService.list(tenantContext.requireTenantId(), filters)
    return inertia.render('operations/opportunities', { ...data, filters } as any)
  }

  async show({ inertia, params }: HttpContext) {
    const data = await operationsService.show(tenantContext.requireTenantId(), params.id)
    return inertia.render('operations/show', data as any)
  }

  async liquidity({ params, response }: HttpContext) {
    const data = await operationsService.show(tenantContext.requireTenantId(), params.id)
    return response.ok({ liquidity: data.liquidity })
  }

  async dossier({ params, response }: HttpContext) {
    return response.ok(await operationsService.dossier(tenantContext.requireTenantId(), params.id))
  }

  async pricing({ params, request, response }: HttpContext) {
    return response.ok(
      await operationsService.show(
        tenantContext.requireTenantId(),
        params.id,
        normalizePricingInput(request.body())
      )
    )
  }

  async pipeline({ inertia }: HttpContext) {
    const data = await operationsService.pipeline(tenantContext.requireTenantId())
    return inertia.render('operations/pipeline', data as any)
  }

  async moveToPipeline({ auth, params, request, requestId, response }: HttpContext) {
    const input = normalizePipelineInput(request.body())

    return response.ok(
      await operationsService.moveToPipeline(tenantContext.requireTenantId(), params.id, {
        ...input,
        userId: auth.getUserOrFail().id,
        requestId,
      })
    )
  }

  async bulkMoveToPipeline({ auth, request, requestId, response }: HttpContext) {
    const body = request.body() as Record<string, unknown>
    const stage = enumOrNull(body.stage, PIPELINE_STAGES) ?? 'qualified'
    const assetIds = Array.isArray(body.assetIds)
      ? body.assetIds.filter((value): value is string => typeof value === 'string')
      : []

    return response.ok(
      await operationsService.bulkMoveToPipeline(tenantContext.requireTenantId(), {
        assetIds,
        stage,
        userId: auth.getUserOrFail().id,
        requestId,
      })
    )
  }
}

function normalizeListFilters(query: Record<string, unknown>): OpportunityListFilters {
  return {
    page: positiveInteger(query.page, 1),
    limit: boundedLimit(query.limit, 25, 100),
    q: stringOrNull(query.q),
    grade: enumOrNull(query.grade, GRADES),
    stage: enumOrNull(query.stage, PIPELINE_STAGES),
    minRiskAdjustedIrr: numberOrNull(query.minRiskAdjustedIrr),
    minFaceValue: numberOrNull(query.minFaceValue),
    maxFaceValue: numberOrNull(query.maxFaceValue),
  }
}

function normalizePricingInput(body: Record<string, unknown>): PricingInput {
  return {
    offerRate: numberOrNull(body.offerRate),
    discountRate: numberOrNull(body.discountRate),
    termMonths: numberOrNull(body.termMonths),
    annualCorrectionRate: numberOrNull(body.annualCorrectionRate),
    operationalCost: numberOrNull(body.operationalCost),
    operationalCostRate: numberOrNull(body.operationalCostRate),
    taxRate: numberOrNull(body.taxRate),
  }
}

function normalizePipelineInput(body: Record<string, unknown>): PipelineUpdateInput {
  return {
    stage: enumOrNull(body.stage, PIPELINE_STAGES) ?? 'qualified',
    offerRate: numberOrNull(body.offerRate),
    termMonths: numberOrNull(body.termMonths),
    priority: numberOrNull(body.priority),
    targetCloseAt: dateTimeOrNull(body.targetCloseAt),
    lastContactedAt: dateTimeOrNull(body.lastContactedAt),
    notes: stringOrNull(body.notes),
  }
}

function dateTimeOrNull(value: unknown) {
  const normalized = stringOrNull(value)

  if (!normalized) {
    return null
  }

  const parsed = DateTime.fromISO(normalized)
  return parsed.isValid ? parsed : null
}
