import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'

import CaseEvent from '#models/case_event'
import GetCaseEventService from '#services/case_events/get_case_event_service'
import CreateCaseEventService from '#services/case_events/create_case_event_service'
import UpdateCaseEventService from '#services/case_events/update_case_event_service'
import DeleteCaseEventService from '#services/case_events/delete_case_event_service'
import { createCaseEventValidator, updateCaseEventValidator } from '#validators/case_event'

@inject()
export default class CaseEventsController {
  /**
   * GET /api/v1/case-events
   */
  async paginate({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const perPage = request.input('per_page', 20)
    const sortBy = request.input('sort_by', 'event_date')
    const direction = request.input('order', 'desc')
    const caseId = request.input('case_id', undefined)
    const eventType = request.input('event_type', undefined)
    const source = request.input('source', undefined)

    const query = CaseEvent.query()
      .if(caseId, (q) => q.where('case_id', caseId))
      .if(eventType, (q) => q.where('event_type', eventType))
      .if(source, (q) => q.where('source', source))
      .orderBy(sortBy, direction)

    const events = await query.paginate(page, perPage)

    return response.json(events)
  }

  /**
   * GET /api/v1/case-events/:id
   */
  async get({ params, response }: HttpContext) {
    const eventId = +params.id
    const service = await app.container.make(GetCaseEventService)
    const event = await service.run(eventId, { withCase: true })

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
    const service = await app.container.make(CreateCaseEventService)
    const event = await service.run(payload, auth.user!.id)

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

    const service = await app.container.make(UpdateCaseEventService)
    const event = await service.run(eventId, payload)
    return response.json(event)
  }

  /**
   * DELETE /api/v1/case-events/:id
   */
  async delete({ params, response }: HttpContext) {
    const eventId = +params.id
    const service = await app.container.make(DeleteCaseEventService)
    await service.run(eventId)
    return response.noContent()
  }
}
