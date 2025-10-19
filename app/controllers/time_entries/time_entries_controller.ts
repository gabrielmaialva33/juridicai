import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import StartTimerService from '#services/time_entries/start_timer_service'
import StopTimerService from '#services/time_entries/stop_timer_service'
import CreateManualEntryService from '#services/time_entries/create_manual_entry_service'
import UpdateTimeEntryService from '#services/time_entries/update_time_entry_service'
import DeleteTimeEntryService from '#services/time_entries/delete_time_entry_service'
import GetTimeEntryStatsService from '#services/time_entries/get_time_entry_stats_service'
import TimeEntry from '#models/time_entry'
import {
  startTimerValidator,
  createManualEntryValidator,
  updateTimeEntryValidator,
  listTimeEntriesValidator,
  statsValidator,
} from '#validators/time_entry'
import { DateTime } from 'luxon'

@inject()
export default class TimeEntriesController {
  constructor(
    private startTimerService: StartTimerService,
    private stopTimerService: StopTimerService,
    private createManualEntryService: CreateManualEntryService,
    private updateTimeEntryService: UpdateTimeEntryService,
    private deleteTimeEntryService: DeleteTimeEntryService,
    private getTimeEntryStatsService: GetTimeEntryStatsService
  ) {}

  /**
   * POST /api/v1/time-entries/start
   * Start a new timer
   */
  async start({ request, response, auth }: HttpContext) {
    const payload = await startTimerValidator.validate(request.all())

    const user = await auth.getUserOrFail() as unknown as User
    const timeEntry = await this.startTimerService.run({
      user_id: user.id,
      ...payload,
    })

    return response.created(timeEntry)
  }

  /**
   * POST /api/v1/time-entries/:id/stop
   * Stop a running timer
   */
  async stop({ params, response, auth }: HttpContext) {
    const user = await auth.getUserOrFail() as unknown as User
    const timeEntry = await this.stopTimerService.run(+params.id, user.id)

    return response.ok(timeEntry)
  }

  /**
   * POST /api/v1/time-entries
   * Create a manual time entry
   */
  async store({ request, response, auth }: HttpContext) {
    const payload = await createManualEntryValidator.validate(request.all())

    const user = await auth.getUserOrFail() as unknown as User
    const timeEntry = await this.createManualEntryService.run({
      user_id: user.id,
      ...payload,
    })

    return response.created(timeEntry)
  }

  /**
   * GET /api/v1/time-entries
   * List time entries with pagination and filters
   */
  async index({ request, response }: HttpContext) {
    const filters = await listTimeEntriesValidator.validate(request.qs())

    const page = filters.page || 1
    const perPage = filters.per_page || 20

    let query = TimeEntry.query().where('is_deleted', false).orderBy('started_at', 'desc')

    // Apply filters
    if (filters.case_id) {
      query = query.where('case_id', filters.case_id)
    }
    if (filters.billable !== undefined) {
      query = query.where('billable', filters.billable)
    }
    if (filters.from_date && filters.to_date) {
      const fromDate = DateTime.fromISO(filters.from_date)
      const toDate = DateTime.fromISO(filters.to_date)
      query = query.whereBetween('started_at', [fromDate.toISO()!, toDate.toISO()!])
    }

    const timeEntries = await query.paginate(page, perPage)

    return response.ok(timeEntries)
  }

  /**
   * GET /api/v1/time-entries/stats
   * Get time entry statistics
   */
  async stats({ request, response, auth }: HttpContext) {
    const filters = await statsValidator.validate(request.qs())

    const user = await auth.getUserOrFail() as unknown as User
    const statsFilters = {
      // Allow user_id from query params, or default to current user if not specified
      user_id: filters.user_id || user.id,
      case_id: filters.case_id,
      from_date: filters.from_date ? DateTime.fromISO(filters.from_date) : undefined,
      to_date: filters.to_date ? DateTime.fromISO(filters.to_date) : undefined,
    }

    const stats = await this.getTimeEntryStatsService.run(statsFilters)

    return response.ok(stats)
  }

  /**
   * PATCH /api/v1/time-entries/:id
   * Update a time entry
   */
  async update({ params, request, response, auth }: HttpContext) {
    const payload = await updateTimeEntryValidator.validate(request.all())

    const user = await auth.getUserOrFail() as unknown as User
    const timeEntry = await this.updateTimeEntryService.run(+params.id, user.id, payload)

    return response.ok(timeEntry)
  }

  /**
   * DELETE /api/v1/time-entries/:id
   * Soft delete a time entry
   */
  async destroy({ params, response, auth }: HttpContext) {
    const user = await auth.getUserOrFail() as unknown as User
    await this.deleteTimeEntryService.run(+params.id, user.id)

    return response.noContent()
  }
}
