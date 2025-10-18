import { inject } from '@adonisjs/core'
import TimeEntry from '#models/time_entry'
import NotFoundException from '#exceptions/not_found_exception'

/**
 * Service to soft delete a time entry
 */
@inject()
export default class DeleteTimeEntryService {
  /**
   * Soft delete a time entry
   */
  async run(timeEntryId: number, userId: number): Promise<void> {
    // Find the time entry - include user_id in the query like StopTimerService does
    const timeEntry = await TimeEntry.query()
      .where('id', timeEntryId)
      .where('user_id', userId)
      .where('is_deleted', false)
      .first()

    if (!timeEntry) {
      throw new NotFoundException(
        `Time entry with ID ${timeEntryId} not found or you don't have permission to delete it`
      )
    }

    // Soft delete
    timeEntry.is_deleted = true
    await timeEntry.save()
  }
}
