import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

import User from '#models/user'
import GetCaseEventService from '#services/case_events/get_case_event_service'
import PaginateCaseEventService from '#services/case_events/paginate_case_event_service'
import CreateCaseEventService from '#services/case_events/create_case_event_service'
import UpdateCaseEventService from '#services/case_events/update_case_event_service'
import DeleteCaseEventService from '#services/case_events/delete_case_event_service'
import { createCaseEventValidator, updateCaseEventValidator } from '#validators/case_event'

@inject()
export default class CaseEventsController {
  constructor(
    private getCaseEventService: GetCaseEventService,
    private paginateCaseEventService: PaginateCaseEventService,
    private createCaseEventService: CreateCaseEventService,
    private updateCaseEventService: UpdateCaseEventService,
    private deleteCaseEventService: DeleteCaseEventService
  ) {}
  /**
   * GET /api/v1/case-events
   */
  async paginate({ request, response }: HttpContext) {
    const events = await this.paginateCaseEventService.run({
      page: request.input('page', 1),
      perPage: request.input('per_page', 20),
      sortBy: request.input('sort_by', 'event_date'),
      direction: request.input('order', 'desc'),
      caseId: request.input('case_id', undefined),
      eventType: request.input('event_type', undefined),
      source: request.input('source', undefined),
    })

    return response.json(events)
  }

  /**
   * GET /api/v1/case-events/:id
   */
  async get({ params, response }: HttpContext) {
    const eventId = +params.id
    const event = await this.getCaseEventService.run(eventId, { withCase: true })

    if (!event) {
      return response.status(404).json({
        message: 'Case event not found',
      })
    }

    return response.json(event)
  }

  /**
   * POST /api/v1/case-events
   */
  async create({ request, response, auth }: HttpContext) {
    const payload = await createCaseEventValidator.validate(request.all())
    const user = (await auth.getUserOrFail()) as unknown as User
    const event = await this.createCaseEventService.run(payload, user.id)

    return response.created(event)
  }

  /**
   * PATCH /api/v1/case-events/:id
   */
  async update({ params, request, response }: HttpContext) {
    const eventId = +params.id
    const payload = await updateCaseEventValidator.validate(request.all(), {
      meta: { eventId },
    })

    // Convert event_date from Date to DateTime if present
    if (payload.event_date) {
      ;(payload as any).event_date = DateTime.fromJSDate(payload.event_date)
    }

    const event = await this.updateCaseEventService.run(eventId, payload as any)
    return response.json(event)
  }

  /**
   * DELETE /api/v1/case-events/:id
   */
  async delete({ params, response }: HttpContext) {
    const eventId = +params.id
    await this.deleteCaseEventService.run(eventId)
    return response.noContent()
  }
}
