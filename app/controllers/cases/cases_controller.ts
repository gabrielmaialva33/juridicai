import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'

import PaginateCaseService from '#services/cases/paginate_case_service'
import GetCaseService from '#services/cases/get_case_service'
import CreateCaseService from '#services/cases/create_case_service'
import UpdateCaseService from '#services/cases/update_case_service'
import DeleteCaseService from '#services/cases/delete_case_service'

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
  async get({ params, request, response }: HttpContext) {
    const caseId = +params.id
    const withClient = request.input('with_client', false)
    const withDeadlines = request.input('with_deadlines', false)
    const withDocuments = request.input('with_documents', false)

    const service = await app.container.make(GetCaseService)

    const caseRecord = await service.run(caseId, {
      withClient,
      withDeadlines,
      withDocuments,
    })

    if (!caseRecord) {
      return response.status(404).json({
        message: 'Case not found',
      })
    }

    return response.json(caseRecord)
  }

  /**
   * POST /api/v1/cases
   */
  async create({ request, response }: HttpContext) {
    const payload = await createCaseValidator.validate(request.all())

    const service = await app.container.make(CreateCaseService)

    const caseRecord = await service.run({
      ...payload,
      filed_at: payload.filed_at ? payload.filed_at.toISOString() : undefined,
      case_number: payload.case_number ?? undefined,
      internal_number: payload.internal_number ?? undefined,
      court: payload.court ?? undefined,
      court_instance: payload.court_instance ?? undefined,
      team_members: payload.team_members ?? undefined,
      tags: payload.tags ?? undefined,
      description: payload.description ?? undefined,
      custom_fields: payload.custom_fields ?? undefined,
      parties: payload.parties ?? undefined,
    })
    return response.created(caseRecord)
  }

  /**
   * PATCH /api/v1/cases/:id
   */
  async update({ params, request, response }: HttpContext) {
    const caseId = +params.id
    const payload = await updateCaseValidator.validate(request.all(), { meta: { caseId } })

    const service = await app.container.make(UpdateCaseService)

    const caseRecord = await service.run(caseId, {
      ...payload,
      filed_at: payload.filed_at ? payload.filed_at.toISOString() : undefined,
      closed_at: payload.closed_at ? payload.closed_at.toISOString() : undefined,
      case_number: payload.case_number ?? undefined,
      internal_number: payload.internal_number ?? undefined,
      court: payload.court ?? undefined,
      court_instance: payload.court_instance ?? undefined,
      team_members: payload.team_members ?? undefined,
      tags: payload.tags ?? undefined,
      description: payload.description ?? undefined,
      custom_fields: payload.custom_fields ?? undefined,
      parties: payload.parties ?? undefined,
    })
    return response.json(caseRecord)
  }

  /**
   * DELETE /api/v1/cases/:id
   * Archive the case (set status to 'archived')
   */
  async delete({ params, response }: HttpContext) {
    const caseId = +params.id

    const service = await app.container.make(DeleteCaseService)
    await service.run(caseId)

    return response.noContent()
  }
}
