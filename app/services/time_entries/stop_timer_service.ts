import { inject } from '@adonisjs/core'
import TimeEntry from '#models/time_entry'
import NotFoundException from '#exceptions/not_found_exception'
import ForbiddenException from '#exceptions/forbidden_exception'
import BadRequestException from '#exceptions/bad_request_exception'
import { DateTime } from 'luxon'

/**
 * Service to stop a running time tracking timer
 */
@inject()
export default class StopTimerService {
  /**
   * Stop a running timer and calculate duration
   */
  async run(timeEntryId: number, userId: number): Promise<TimeEntry> {
    // Find the time entry - only allow stopping own timers
    const timeEntry = await TimeEntry.query()
      .where('id', timeEntryId)
      .where('user_id', userId)
      .where('is_deleted', false)
      .first()

    if (!timeEntry) {
      // Check if it exists but belongs to another user
      const otherUserEntry = await TimeEntry.query()
        .where('id', timeEntryId)
        .where('is_deleted', false)
        .first()

      if (otherUserEntry) {
        throw new ForbiddenException('You can only stop your own timers')
      }

      throw new NotFoundException(`Time entry with ID ${timeEntryId} not found`)
    }

    // Check if timer is already stopped
    if (timeEntry.ended_at) {
      throw new BadRequestException('This timer is already stopped')
    }

    // Calculate duration
    const endedAt = DateTime.now()
    const durationMinutes = Math.round(endedAt.diff(timeEntry.started_at, 'minutes').minutes)

    // Update time entry
    timeEntry.ended_at = endedAt
    timeEntry.duration_minutes = durationMinutes
    await timeEntry.save()

    return timeEntry
  }
}
