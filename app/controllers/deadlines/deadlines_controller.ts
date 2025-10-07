import { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'

import GetDeadlineService from '#services/deadlines/get_deadline_service'
import PaginateDeadlineService from '#services/deadlines/paginate_deadline_service'
import CreateDeadlineService from '#services/deadlines/create_deadline_service'
import UpdateDeadlineService from '#services/deadlines/update_deadline_service'
import CompleteDeadlineService from '#services/deadlines/complete_deadline_service'
import DeleteDeadlineService from '#services/deadlines/delete_deadline_service'
import {
  createDeadlineValidator,
  updateDeadlineValidator,
  completeDeadlineValidator,
} from '#validators/deadline'

export default class DeadlinesController {
  /**
   * GET /api/v1/deadlines
   */
  async paginate({ request, response }: HttpContext) {
    const service = await app.container.make(PaginateDeadlineService)

    // Convert boolean query params correctly
    const isFatalParam = request.input('is_fatal')
    const isFatal = isFatalParam !== undefined ? isFatalParam === 'true' : undefined

    const deadlines = await service.run({
      page: request.input('page', 1),
      perPage: request.input('per_page', 20),
      sortBy: request.input('sort_by', 'deadline_date'),
      direction: request.input('order', 'asc'),
      caseId: request.input('case_id', undefined),
      status: request.input('status', undefined),
      isFatal,
      responsibleId: request.input('responsible_id', undefined),
    })

    return response.json(deadlines)
  }

  /**
   * GET /api/v1/deadlines/upcoming
   */
  async upcoming({ request, response }: HttpContext) {
    const service = await app.container.make(PaginateDeadlineService)

    const days = request.input('days', 7)
    const deadlines = await service.getUpcoming(days)

    return response.json(deadlines)
  }

  /**
   * GET /api/v1/deadlines/:id
   */
  async get({ params, response }: HttpContext) {
    const deadlineId = +params.id
    const service = await app.container.make(GetDeadlineService)
    const deadline = await service.run(deadlineId, { withCase: true })

    if (!deadline) {
      return response.status(404).json({
        message: 'Deadline not found',
      })
    }

    return response.json(deadline)
  }

  /**
   * POST /api/v1/deadlines
   */
  async create({ request, response }: HttpContext) {
    const payload = await createDeadlineValidator.validate(request.all())

    const service = await app.container.make(CreateDeadlineService)
    const deadline = await service.run({
      ...payload,
      deadline_date: payload.deadline_date.toISOString(),
      description: payload.description ?? undefined,
      internal_deadline_date: payload.internal_deadline_date
        ? payload.internal_deadline_date.toISOString()
        : undefined,
      alert_config: payload.alert_config ?? undefined,
    })

    return response.created(deadline)
  }

  /**
   * PATCH /api/v1/deadlines/:id
   */
  async update({ params, request, response }: HttpContext) {
    const deadlineId = +params.id
    const payload = await updateDeadlineValidator.validate(request.all(), {
      meta: { deadlineId },
    })

    const service = await app.container.make(UpdateDeadlineService)
    const deadline = await service.run(deadlineId, {
      ...payload,
      deadline_date: payload.deadline_date ? payload.deadline_date.toISOString() : undefined,
      description: payload.description ?? undefined,
      internal_deadline_date: payload.internal_deadline_date
        ? payload.internal_deadline_date.toISOString()
        : undefined,
      alert_config: payload.alert_config ?? undefined,
    })

    return response.json(deadline)
  }

  /**
   * PATCH /api/v1/deadlines/:id/complete
   */
  async complete({ params, request, response, auth }: HttpContext) {
    const deadlineId = +params.id
    const payload = await completeDeadlineValidator.validate(request.all())

    const completedBy = payload.completed_by || auth.user!.id
    const completionNotes = payload.completion_notes ?? undefined

    const service = await app.container.make(CompleteDeadlineService)
    const deadline = await service.run(deadlineId, completedBy, completionNotes)

    return response.json(deadline)
  }

  /**
   * DELETE /api/v1/deadlines/:id
   */
  async delete({ params, response }: HttpContext) {
    const deadlineId = +params.id

    const service = await app.container.make(DeleteDeadlineService)
    await service.run(deadlineId)

    return response.noContent()
  }
}
