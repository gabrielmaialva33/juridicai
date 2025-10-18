import { inject } from '@adonisjs/core'
import TimeEntry from '#models/time_entry'
import NotFoundException from '#exceptions/not_found_exception'
import ForbiddenException from '#exceptions/forbidden_exception'
import logger from '@adonisjs/core/services/logger'

/**
 * Service to soft delete a time entry
 */
@inject()
export default class DeleteTimeEntryService {
  /**
   * Soft delete a time entry
   */
  async run(timeEntryId: number, userId: number): Promise<void> {
    // Find the time entry
    const timeEntry = await TimeEntry.query()
      .where('id', timeEntryId)
      .where('is_deleted', false)
      .first()

    if (!timeEntry) {
      throw new NotFoundException(`Time entry with ID ${timeEntryId} not found`)
    }

    // Check ownership
    logger.info(`DeleteTimeEntry ownership check - DB user_id: ${timeEntry.user_id}, Request user_id: ${userId}, Match: ${timeEntry.user_id === userId}`)
    if (timeEntry.user_id !== userId) {
      throw new ForbiddenException('You can only delete your own time entries')
    }

    // Soft delete
    timeEntry.is_deleted = true
    await timeEntry.save()
  }
}
