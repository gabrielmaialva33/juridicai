import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'

import PaginateCaseService from '#services/cases/paginate_case_service'
import GetCaseService from '#services/cases/get_case_service'
import CreateCaseService from '#services/cases/create_case_service'
import UpdateCaseService from '#services/cases/update_case_service'
import DeleteCaseService from '#services/cases/delete_case_service'

import { createCaseValidator, updateCaseValidator } from '#validators/case'

@inject()
export default class CasesController {
  constructor(
    private paginateCaseService: PaginateCaseService,
    private getCaseService: GetCaseService,
    private createCaseService: CreateCaseService,
    private updateCaseService: UpdateCaseService,
    private deleteCaseService: DeleteCaseService
  ) {}

  /**
   * GET /cases
   * Render cases page (Inertia)
   */
  async index({ inertia }: HttpContext) {
    return inertia.render('cases/index')
  }

  /**
   * GET /api/v1/cases
   */
  async paginate({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const perPage = request.input('per_page', 20)
    const sortBy = request.input('sort_by', 'created_at')
    const direction = request.input('order', 'desc')
    const search = request.input('search')
    const clientId = request.input('client_id')
    const status = request.input('status')
    const priority = request.input('priority')
    const caseType = request.input('case_type')
    const responsibleLawyerId = request.input('responsible_lawyer_id')
    const withRelationships = request.input('with_relationships') === 'true'
    const withDeadlinesCount = request.input('with_deadlines_count') === 'true'
    const withDocumentsCount = request.input('with_documents_count') === 'true'

    const cases = await this.paginateCaseService.run({
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
    const withClient = request.input('with_client') === 'true'
    const withDeadlines = request.input('with_deadlines') === 'true'
    const withDocuments = request.input('with_documents') === 'true'

    const caseRecord = await this.getCaseService.run(caseId, {
      withClient,
      withDeadlines,
      withDocuments,
    })

    return response.json(caseRecord)
  }

  /**
   * POST /api/v1/cases
   */
  async create({ request, response }: HttpContext) {
    const payload = await createCaseValidator.validate(request.all())

    const caseRecord = await this.createCaseService.run({
      ...payload,
      description: payload.description ?? undefined,
      court: payload.court ?? undefined,
      court_instance: payload.court_instance ?? undefined,
      tags: payload.tags ?? undefined,
      parties: payload.parties ?? undefined,
      team_members: payload.team_members ?? undefined,
      custom_fields: payload.custom_fields ?? undefined,
      filed_at: payload.filed_at ? payload.filed_at.toISOString() : undefined,
    })

    return response.created(caseRecord)
  }

  /**
   * PATCH /api/v1/cases/:id
   */
  async update({ params, request, response }: HttpContext) {
    const caseId = +params.id
    const payload = await updateCaseValidator.validate(request.all(), { meta: { caseId } })

    const caseRecord = await this.updateCaseService.run(caseId, {
      ...payload,
      description: payload.description ?? undefined,
      court: payload.court ?? undefined,
      court_instance: payload.court_instance ?? undefined,
      tags: payload.tags ?? undefined,
      parties: payload.parties ?? undefined,
      team_members: payload.team_members ?? undefined,
      custom_fields: payload.custom_fields ?? undefined,
      filed_at: payload.filed_at ? payload.filed_at.toISOString() : undefined,
      closed_at: payload.closed_at ? payload.closed_at.toISOString() : undefined,
    })

    return response.json(caseRecord)
  }

  /**
   * DELETE /api/v1/cases/:id
   * Archive the case (set status to 'archived')
   */
  async delete({ params, response }: HttpContext) {
    const caseId = +params.id
    await this.deleteCaseService.run(caseId)

    return response.noContent()
  }
}
