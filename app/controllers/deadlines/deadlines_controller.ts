import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'

import User from '#models/user'
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

@inject()
export default class DeadlinesController {
  constructor(
    private getDeadlineService: GetDeadlineService,
    private paginateDeadlineService: PaginateDeadlineService,
    private createDeadlineService: CreateDeadlineService,
    private updateDeadlineService: UpdateDeadlineService,
    private completeDeadlineService: CompleteDeadlineService,
    private deleteDeadlineService: DeleteDeadlineService
  ) {}
  /**
   * GET /api/v1/deadlines
   */
  async paginate({ request, response }: HttpContext) {
    const isFatalParam = request.input('is_fatal')
    const isFatal = isFatalParam !== undefined ? isFatalParam === 'true' : undefined

    const deadlines = await this.paginateDeadlineService.run({
      page: request.input('page', 1),
      perPage: request.input('per_page', 20),
      sortBy: request.input('sort_by', 'deadline_date'),
      direction: request.input('order', 'asc'),
      caseId: request.input('case_id'),
      status: request.input('status'),
      isFatal,
      responsibleId: request.input('responsible_id'),
    })

    return response.json(deadlines)
  }

  /**
   * GET /api/v1/deadlines/upcoming
   */
  async upcoming({ request, response }: HttpContext) {
    const days = request.input('days', 7)
    const deadlines = await this.paginateDeadlineService.getUpcoming(days)

    return response.json(deadlines)
  }

  /**
   * GET /api/v1/deadlines/:id
   */
  async get({ params, response }: HttpContext) {
    const deadlineId = +params.id
    const deadline = await this.getDeadlineService.run(deadlineId, { withCase: true })

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

    const deadline = await this.createDeadlineService.run({
      ...payload,
      description: payload.description ?? undefined,
      alert_config: payload.alert_config ?? undefined,
      deadline_date: payload.deadline_date.toISOString(),
      internal_deadline_date: payload.internal_deadline_date
        ? payload.internal_deadline_date.toISOString()
        : undefined,
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

    const deadline = await this.updateDeadlineService.run(deadlineId, {
      ...payload,
      description: payload.description ?? undefined,
      alert_config: payload.alert_config ?? undefined,
      deadline_date: payload.deadline_date ? payload.deadline_date.toISOString() : undefined,
      internal_deadline_date: payload.internal_deadline_date
        ? payload.internal_deadline_date.toISOString()
        : undefined,
    })

    return response.json(deadline)
  }

  /**
   * PATCH /api/v1/deadlines/:id/complete
   */
  async complete({ params, request, response, auth }: HttpContext) {
    const deadlineId = +params.id
    const payload = await completeDeadlineValidator.validate(request.all())

    const user = (await auth.getUserOrFail()) as unknown as User
    const completedBy = payload.completed_by || user.id
    const completionNotes = payload.completion_notes ?? undefined

    const deadline = await this.completeDeadlineService.run(
      deadlineId,
      completedBy,
      completionNotes
    )

    return response.json(deadline)
  }

  /**
   * DELETE /api/v1/deadlines/:id
   */
  async delete({ params, response }: HttpContext) {
    const deadlineId = +params.id
    await this.deleteDeadlineService.run(deadlineId)

    return response.noContent()
  }
}
