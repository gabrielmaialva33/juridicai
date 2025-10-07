import { inject } from '@adonisjs/core'
import CaseEventsRepository from '#repositories/case_events_repository'
import NotFoundException from '#exceptions/not_found_exception'

/**
 * Service for deleting a case event
 *
 * Performs hard delete using event.delete()
 *
 * @example
 * await deleteCaseEventService.run(123)
 */
@inject()
export default class DeleteCaseEventService {
  constructor(private caseEventsRepository: CaseEventsRepository) {}

  /**
   * Delete a case event by ID
   *
   * @param eventId - The ID of the case event to delete
   * @returns Promise<void>
   * @throws {NotFoundException} if case event not found
   */
  async run(eventId: number): Promise<void> {
    const event = await this.caseEventsRepository.findBy('id', eventId)

    if (!event) {
      throw new NotFoundException('Case event not found')
    }

    await event.delete()
  }
}
