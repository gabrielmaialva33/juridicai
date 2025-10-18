import { inject } from '@adonisjs/core'
import TimeEntry from '#models/time_entry'
import Case from '#models/case'
import NotFoundException from '#exceptions/not_found_exception'
import BadRequestException from '#exceptions/bad_request_exception'
import { DateTime } from 'luxon'

interface StartTimerPayload {
  user_id: number
  case_id: number
  description?: string
  billable?: boolean
  hourly_rate?: number
  tags?: string[]
}

/**
 * Service to start a new time tracking timer
 */
@inject()
export default class StartTimerService {
  /**
   * Start a new timer for time tracking
   */
  async run(payload: StartTimerPayload): Promise<TimeEntry> {
    // Verify case exists
    const caseRecord = await Case.find(payload.case_id)
    if (!caseRecord) {
      throw new NotFoundException(`Case with ID ${payload.case_id} not found`)
    }

    // Check if user h running timers
    const runningTimer = await TimeEntry.query()
      .where('user_id', payload.user_id)
      .whereNull('ended_at')
      .where('is_deleted', false)
      .first()

    if (runningTimer) {
      throw new BadRequestException(
        'You already have a running timer. Please stop it before starting a new one.'
      )
    }

    // Create new time entry
    const timeEntry = await TimeEntry.create({
      user_id: payload.user_id,
      case_id: payload.case_id,
      started_at: DateTime.now(),
      ended_at: null,
      duration_minutes: null,
      description: payload.description ?? null,
      billable: payload.billable ?? true,
      hourly_rate: payload.hourly_rate ?? null,
      tags: payload.tags ?? [],
    })

    return timeEntry
  }
}
