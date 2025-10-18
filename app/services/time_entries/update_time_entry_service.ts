import { inject } from '@adonisjs/core'
import TimeEntry from '#models/time_entry'
import NotFoundException from '#exceptions/not_found_exception'
import { DateTime } from 'luxon'

interface UpdateTimeEntryPayload {
  description?: string
  billable?: boolean
  hourly_rate?: number
  tags?: string[]
  started_at?: string | DateTime
  ended_at?: string | DateTime
}

/**
 * Service to update a time entry
 */
@inject()
export default class UpdateTimeEntryService {
  /**
   * Update a time entry
   */
  async run(
    timeEntryId: number,
    userId: number,
    payload: UpdateTimeEntryPayload
  ): Promise<TimeEntry> {
    // Find the time entry - include user_id in the query like StopTimerService does
    const timeEntry = await TimeEntry.query()
      .where('id', timeEntryId)
      .where('user_id', userId)
      .where('is_deleted', false)
      .first()

    if (!timeEntry) {
      throw new NotFoundException(
        `Time entry with ID ${timeEntryId} not found or you don't have permission to update it`
      )
    }

    // Update fields
    if (payload.description !== undefined) {
      timeEntry.description = payload.description
    }
    if (payload.billable !== undefined) {
      timeEntry.billable = payload.billable
    }
    if (payload.hourly_rate !== undefined) {
      timeEntry.hourly_rate = payload.hourly_rate
    }
    if (payload.tags !== undefined) {
      timeEntry.tags = payload.tags
    }

    // Update dates if provided
    if (payload.started_at) {
      timeEntry.started_at =
        typeof payload.started_at === 'string'
          ? DateTime.fromISO(payload.started_at)
          : payload.started_at
    }
    if (payload.ended_at) {
      timeEntry.ended_at =
        typeof payload.ended_at === 'string' ? DateTime.fromISO(payload.ended_at) : payload.ended_at
    }

    // Recalculate duration if both dates are set
    if (timeEntry.started_at && timeEntry.ended_at) {
      const durationMinutes = Math.round(
        timeEntry.ended_at.diff(timeEntry.started_at, 'minutes').minutes
      )
      timeEntry.duration_minutes = durationMinutes
    }

    await timeEntry.save()

    return timeEntry
  }
}
