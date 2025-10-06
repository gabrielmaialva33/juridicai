import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'

import PaginateCaseService from '#services/cases/paginate_case_service'
import CasesRepository from '#repositories/cases_repository'
import Case from '#models/case'

import { createCaseValidator, updateCaseValidator } from '#validators/case'

@inject()
export default class CasesController {
  /**
   * GET /api/v1/cases
   */
  async paginate({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const perPage = request.input('per_page', 20)
    const sortBy = request.input('sort_by', 'created_at')
    const direction = request.input('order', 'desc')
    const search = request.input('search', undefined)
    const clientId = request.input('client_id', undefined)
    const status = request.input('status', undefined)
    const priority = request.input('priority', undefined)
    const caseType = request.input('case_type', undefined)
    const responsibleLawyerId = request.input('responsible_lawyer_id', undefined)
    const withRelationships = request.input('with_relationships', false)
    const withDeadlinesCount = request.input('with_deadlines_count', false)
    const withDocumentsCount = request.input('with_documents_count', false)

    const service = await app.container.make(PaginateCaseService)
    const cases = await service.run({
      page,
      perPage,
      sortBy,
      direction,
      search,
      clientId,
      status,
      priority,
      caseType,
      assignedTo: responsibleLawyerId,
      withRelationships,
      withDeadlinesCount,
      withDocumentsCount,
    })

    return response.json(cases)
  }

  /**
   * GET /api/v1/cases/:id
   */
  async get({ params, response }: HttpContext) {
    const caseId = +params.id
    const casesRepo = await app.container.make(CasesRepository)
    const caseRecord = await casesRepo.findBy('id', caseId)

    if (!caseRecord) {
      return response.status(404).json({
        message: 'Case not found',
      })
    }

    await (caseRecord as any).load('client')
    return response.json(caseRecord)
  }

  /**
   * POST /api/v1/cases
   */
  async create({ request, response }: HttpContext) {
    const payload = await createCaseValidator.validate(request.all())

    const caseRecord = await Case.create({
      ...payload,
      filed_at: payload.filed_at ? DateTime.fromJSDate(payload.filed_at) : undefined,
      closed_at: payload.closed_at ? DateTime.fromJSDate(payload.closed_at) : undefined,
      parties: payload.parties as any,
    })
    return response.created(caseRecord)
  }

  /**
   * PATCH /api/v1/cases/:id
   */
  async update({ params, request, response }: HttpContext) {
    const caseId = +params.id
    const payload = await updateCaseValidator.validate(request.all(), { meta: { caseId } })

    const casesRepo = await app.container.make(CasesRepository)
    const caseRecord = await casesRepo.findBy('id', caseId)

    if (!caseRecord) {
      return response.status(404).json({
        message: 'Case not found',
      })
    }

    const updateData = {
      ...payload,
      filed_at: payload.filed_at ? DateTime.fromJSDate(payload.filed_at) : undefined,
      closed_at: payload.closed_at ? DateTime.fromJSDate(payload.closed_at) : undefined,
      parties: payload.parties as any,
    }

    caseRecord.merge(updateData)
    await caseRecord.save()
    return response.json(caseRecord)
  }

  /**
   * DELETE /api/v1/cases/:id
   * Archive the case (set status to 'archived')
   */
  async delete({ params, response }: HttpContext) {
    const caseId = +params.id
    const casesRepo = await app.container.make(CasesRepository)
    const caseRecord = await casesRepo.findBy('id', caseId)

    if (!caseRecord) {
      return response.status(404).json({
        message: 'Case not found',
      })
    }

    caseRecord.status = 'archived'
    await caseRecord.save()
    return response.noContent()
  }
}
