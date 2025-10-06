import { inject } from '@adonisjs/core'
import DeadlinesRepository from '#repositories/deadlines_repository'
import Deadline from '#models/deadline'

/**
 * Service for retrieving a single deadline
 */
@inject()
export default class GetDeadlineService {
  constructor(private deadlinesRepository: DeadlinesRepository) {}

  /**
   * Get a deadline by ID with optional relationships
   * @param deadlineId - The deadline ID to retrieve
   * @param options - Options for loading relationships
   * @returns Deadline or null if not found
   */
  async run(
    deadlineId: number,
    options: {
      withCase?: boolean
      withResponsible?: boolean
    } = {}
  ): Promise<Deadline | null> {
    const deadline = await this.deadlinesRepository.findBy('id', deadlineId)

    if (!deadline) {
      return null
    }

    // Load requested relationships
    if (options.withCase) {
      await (deadline as any).load('case', (caseQuery: any) => {
        caseQuery.preload('client')
      })
    }

    if (options.withResponsible) {
      await (deadline as any).load('responsible')
    }

    return deadline
  }
}
