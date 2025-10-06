import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import DeadlinesRepository from '#repositories/deadlines_repository'
import IDeadline from '#interfaces/deadline_interface'
import Deadline from '#models/deadline'

/**
 * Service for creating new deadlines
 */
@inject()
export default class CreateDeadlineService {
  constructor(private deadlinesRepository: DeadlinesRepository) {}

  /**
   * Create a new deadline
   * @param payload - Deadline creation data
   * @returns Created deadline
   */
  async run(payload: IDeadline.CreatePayload): Promise<Deadline> {
    // Convert date strings to DateTime objects
    const deadlineDate = DateTime.fromJSDate(new Date(payload.deadline_date))
    const internalDeadlineDate = payload.internal_deadline_date
      ? DateTime.fromJSDate(new Date(payload.internal_deadline_date))
      : null

    // Set defaults
    const deadlineData = {
      ...payload,
      deadline_date: deadlineDate,
      internal_deadline_date: internalDeadlineDate,
      status: payload.status || 'pending',
      is_fatal: payload.is_fatal ?? false,
    }

    return this.deadlinesRepository.create(deadlineData)
  }
}
