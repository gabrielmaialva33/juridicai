import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import DeadlinesRepository from '#repositories/deadlines_repository'
import IDeadline from '#interfaces/deadline_interface'
import Deadline from '#models/deadline'

/**
 * Service for updating existing deadlines
 */
@inject()
export default class UpdateDeadlineService {
  constructor(private deadlinesRepository: DeadlinesRepository) {}

  /**
   * Update a deadline
   * @param deadlineId - The deadline ID to update
   * @param payload - Updated deadline data
   * @returns Updated deadline
   * @throws Error if deadline not found
   */
  async run(deadlineId: number, payload: IDeadline.EditPayload): Promise<Deadline> {
    const deadline = await this.deadlinesRepository.findBy('id', deadlineId)

    if (!deadline) {
      throw new Error('Deadline not found')
    }

    // Convert date strings to DateTime objects if they exist
    const updateData: any = { ...payload }

    if (payload.deadline_date) {
      updateData.deadline_date = DateTime.fromJSDate(new Date(payload.deadline_date))
    }

    if (payload.internal_deadline_date) {
      updateData.internal_deadline_date = DateTime.fromJSDate(
        new Date(payload.internal_deadline_date)
      )
    }

    if (payload.completed_at) {
      updateData.completed_at = DateTime.fromJSDate(new Date(payload.completed_at))
    }

    deadline.merge(updateData)
    await deadline.save()

    return deadline
  }
}
