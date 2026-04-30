import dataJudCandidateApiService, {
  serializeDataJudCandidate,
  type DataJudCandidateListFilters,
} from '#modules/integrations/services/datajud_candidate_api_service'
import dataJudCandidateReviewService, {
  DataJudCandidateReviewError,
} from '#modules/integrations/services/datajud_candidate_review_service'
import tenantContext from '#shared/helpers/tenant_context'
import {
  boundedLimit,
  enumOrNull,
  numberOrNull,
  positiveInteger,
  stringOrNull,
} from '#shared/helpers/request_filters'
import type { HttpContext } from '@adonisjs/core/http'

export default class DataJudCandidatesController {
  async index({ request, response }: HttpContext) {
    const filters = normalizeFilters(request.qs())
    const candidates = await dataJudCandidateApiService.list(
      tenantContext.requireTenantId(),
      filters
    )

    return response.ok({
      candidates: candidates.all().map((candidate) => serializeDataJudCandidate(candidate)),
      meta: candidates.getMeta(),
      filters,
    })
  }

  async show({ params, response }: HttpContext) {
    const candidate = await dataJudCandidateApiService.show(
      tenantContext.requireTenantId(),
      params.id
    )

    return response.ok({
      candidate: serializeDataJudCandidate(candidate, { includeRawData: true }),
    })
  }

  async accept({ params, request, response }: HttpContext) {
    try {
      const result = await dataJudCandidateReviewService.accept(params.id, {
        tenantId: tenantContext.requireTenantId(),
        force: booleanInput(request.input('force')),
        minScore: numberOrNull(request.input('minScore')) ?? undefined,
      })
      const candidate = await dataJudCandidateApiService.show(
        tenantContext.requireTenantId(),
        result.candidate.id
      )

      return response.ok({
        candidate: serializeDataJudCandidate(candidate, { includeRawData: true }),
        judicialProcess: result.judicialProcess.serialize(),
      })
    } catch (error) {
      if (error instanceof DataJudCandidateReviewError) {
        return response.status(422).send({
          code: error.code,
          message: error.message,
        })
      }

      throw error
    }
  }

  async reject({ params, response }: HttpContext) {
    await dataJudCandidateReviewService.reject(params.id, {
      tenantId: tenantContext.requireTenantId(),
    })
    const candidate = await dataJudCandidateApiService.show(
      tenantContext.requireTenantId(),
      params.id
    )

    return response.ok({
      candidate: serializeDataJudCandidate(candidate, { includeRawData: true }),
    })
  }

  async markAmbiguous({ params, response }: HttpContext) {
    await dataJudCandidateReviewService.markAmbiguous(params.id, {
      tenantId: tenantContext.requireTenantId(),
    })
    const candidate = await dataJudCandidateApiService.show(
      tenantContext.requireTenantId(),
      params.id
    )

    return response.ok({
      candidate: serializeDataJudCandidate(candidate, { includeRawData: true }),
    })
  }
}

function normalizeFilters(query: Record<string, unknown>): DataJudCandidateListFilters {
  return {
    page: positiveInteger(query.page, 1),
    limit: boundedLimit(query.limit),
    assetId: stringOrNull(query.assetId),
    source: enumOrNull(query.source, [
      'siop',
      'datajud',
      'djen',
      'tribunal',
      'api_private',
      'manual',
    ]),
    status: enumOrNull(query.status, ['candidate', 'accepted', 'rejected', 'ambiguous']),
    minScore: numberOrNull(query.minScore),
    maxScore: numberOrNull(query.maxScore),
    q: stringOrNull(query.q),
    sortBy: enumOrNull(query.sortBy, ['created_at', 'updated_at', 'score']) ?? 'score',
    sortDirection: enumOrNull(query.sortDirection, ['asc', 'desc']) ?? 'desc',
  }
}

function booleanInput(value: unknown) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value === 1
  }

  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
  }

  return false
}
