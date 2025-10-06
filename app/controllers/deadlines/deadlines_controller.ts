import { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'

import Deadline from '#models/deadline'
import GetDeadlineService from '#services/deadlines/get_deadline_service'
import CreateDeadlineService from '#services/deadlines/create_deadline_service'
import UpdateDeadlineService from '#services/deadlines/update_deadline_service'
import CompleteDeadlineService from '#services/deadlines/complete_deadline_service'
import DeleteDeadlineService from '#services/deadlines/delete_deadline_service'
import {
  createDeadlineValidator,
  updateDeadlineValidator,
  completeDeadlineValidator,
} from '#validators/deadline'
import { DateTime } from 'luxon'

export default class DeadlinesController {
  /**
   * GET /api/v1/deadlines
   */
  async paginate({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const perPage = request.input('per_page', 20)
    const sortBy = request.input('sort_by', 'deadline_date')
    const direction = request.input('order', 'asc')
    const caseId = request.input('case_id', undefined)
    const status = request.input('status', undefined)

    // Convert boolean query params correctly
    const isFatalParam = request.input('is_fatal')
    const isFatal = isFatalParam !== undefined ? isFatalParam === 'true' : undefined

    const responsibleId = request.input('responsible_id', undefined)

    const query = Deadline.query()
      .if(caseId, (q) => q.where('case_id', caseId))
      .if(status, (q) => q.where('status', status))
      .if(isFatal !== undefined, (q) => q.where('is_fatal', isFatal))
      .if(responsibleId, (q) => q.where('responsible_id', responsibleId))
      .orderBy(sortBy, direction)

    const deadlines = await query.paginate(page, perPage)

    return response.json(deadlines)
  }

  /**
   * GET /api/v1/deadlines/upcoming
   */
  async upcoming({ request, response }: HttpContext) {
    const days = request.input('days', 7)
    const upcomingDate = DateTime.now().plus({ days })

    const deadlines = await Deadline.query()
      .where('status', 'pending')
      .where('deadline_date', '<=', upcomingDate.toSQLDate())
      .orderBy('deadline_date', 'asc')
      .limit(50)

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
