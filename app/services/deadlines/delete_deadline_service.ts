import { inject } from '@adonisjs/core'
import DeadlinesRepository from '#repositories/deadlines_repository'

/**
 * Service for deleting (cancelling) deadlines
 */
@inject()
export default class DeleteDeadlineService {
  constructor(private deadlinesRepository: DeadlinesRepository) {}

  /**
   * Soft delete a deadline by marking it as cancelled
   * @param deadlineId - The deadline ID to delete
   * @throws Error if deadline not found
   */
  async run(deadlineId: number): Promise<void> {
    const deadline = await this.deadlinesRepository.findBy('id', deadlineId)

    if (!deadline) {
      throw new Error('Deadline not found')
    }

    // Soft delete by setting status to cancelled
    deadline.status = 'cancelled'
    await deadline.save()
  }
}
