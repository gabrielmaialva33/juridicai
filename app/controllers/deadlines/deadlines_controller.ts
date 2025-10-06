import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'

import Deadline from '#models/deadline'
import DeadlinesRepository from '#repositories/deadlines_repository'
import {
  createDeadlineValidator,
  updateDeadlineValidator,
  completeDeadlineValidator,
} from '#validators/deadline'
import { DateTime } from 'luxon'

@inject()
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
    const isFatal = request.input('is_fatal', undefined)
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
    const deadlinesRepo = await app.container.make(DeadlinesRepository)
    const deadline = await deadlinesRepo.findBy('id', deadlineId)

    if (!deadline) {
      return response.status(404).json({
        message: 'Deadline not found',
      })
    }

    await (deadline as any).load('case')
    return response.json(deadline)
  }

  /**
   * POST /api/v1/deadlines
   */
  async create({ request, response }: HttpContext) {
    const payload = await createDeadlineValidator.validate(request.all())

    const deadline = await Deadline.create({
      ...payload,
      deadline_date: DateTime.fromJSDate(payload.deadline_date),
      internal_deadline_date: payload.internal_deadline_date
        ? DateTime.fromJSDate(payload.internal_deadline_date)
        : undefined,
      status: payload.status || 'pending',
      is_fatal: payload.is_fatal ?? false,
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

    const deadlinesRepo = await app.container.make(DeadlinesRepository)
    const deadline = await deadlinesRepo.findBy('id', deadlineId)

    if (!deadline) {
      return response.status(404).json({
        message: 'Deadline not found',
      })
    }

    const updateData = {
      ...payload,
      deadline_date: payload.deadline_date ? DateTime.fromJSDate(payload.deadline_date) : undefined,
      internal_deadline_date: payload.internal_deadline_date
        ? DateTime.fromJSDate(payload.internal_deadline_date)
        : undefined,
    }

    deadline.merge(updateData)
    await deadline.save()
    return response.json(deadline)
  }

  /**
   * PATCH /api/v1/deadlines/:id/complete
   */
  async complete({ params, request, response, auth }: HttpContext) {
    const deadlineId = +params.id
    const payload = await completeDeadlineValidator.validate(request.all())

    const deadlinesRepo = await app.container.make(DeadlinesRepository)
    const deadline = await deadlinesRepo.findBy('id', deadlineId)

    if (!deadline) {
      return response.status(404).json({
        message: 'Deadline not found',
      })
    }

    deadline.status = 'completed'
    deadline.completed_at = DateTime.now()
    deadline.completed_by = payload.completed_by || auth.user!.id
    deadline.completion_notes = payload.completion_notes || null

    await deadline.save()
    return response.json(deadline)
  }

  /**
   * DELETE /api/v1/deadlines/:id
   */
  async delete({ params, response }: HttpContext) {
    const deadlineId = +params.id
    const deadlinesRepo = await app.container.make(DeadlinesRepository)
    const deadline = await deadlinesRepo.findBy('id', deadlineId)

    if (!deadline) {
      return response.status(404).json({
        message: 'Deadline not found',
      })
    }

    deadline.status = 'cancelled'
    await deadline.save()
    return response.noContent()
  }
}
