import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import DeadlinesRepository from '#repositories/deadlines_repository'
import Deadline from '#models/deadline'

/**
 * Service for completing deadlines
 */
@inject()
export default class CompleteDeadlineService {
  constructor(private deadlinesRepository: DeadlinesRepository) {}

  /**
   * Mark a deadline as completed
   * @param deadlineId - The deadline ID to complete
   * @param completedBy - User ID who completed the deadline
   * @param completionNotes - Optional notes about the completion
   * @returns Completed deadline
   * @throws Error if deadline not found
   */
  async run(deadlineId: number, completedBy: number, completionNotes?: string): Promise<Deadline> {
    const deadline = await this.deadlinesRepository.findBy('id', deadlineId)

    if (!deadline) {
      throw new Error('Deadline not found')
    }

    // Set completion data
    deadline.status = 'completed'
    deadline.completed_at = DateTime.now()
    deadline.completed_by = completedBy
    deadline.completion_notes = completionNotes || null

    await deadline.save()

    return deadline
  }
}
