import CaseEvent from '#models/case_event'

/**
 * Service for deleting a case event
 *
 * Performs hard delete using event.delete()
 *
 * @example
 * await deleteCaseEventService.run(123)
 */
export default class DeleteCaseEventService {
  /**
   * Delete a case event by ID
   *
   * @param eventId - The ID of the case event to delete
   * @returns Promise<void>
   * @throws Error if case event not found
   */
  async run(eventId: number): Promise<void> {
    const event = await CaseEvent.find(eventId)

    if (!event) {
      throw new Error('Case event not found')
    }

    await event.delete()
  }
}
