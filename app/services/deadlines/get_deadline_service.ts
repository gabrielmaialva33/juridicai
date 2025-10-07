import { inject } from '@adonisjs/core'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import DeadlinesRepository from '#repositories/deadlines_repository'
import Deadline from '#models/deadline'
import Case from '#models/case'
import NotFoundException from '#exceptions/not_found_exception'

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
   * @returns Deadline instance
   * @throws {NotFoundException} if deadline not found
   */
  async run(
    deadlineId: number,
    options: {
      withCase?: boolean
      withResponsible?: boolean
    } = {}
  ): Promise<Deadline> {
    const deadline = await this.deadlinesRepository.findBy('id', deadlineId)

    if (!deadline) {
      throw new NotFoundException('Deadline not found')
    }

    // Load requested relationships
    if (options.withCase) {
      await deadline.load('case' as any, (caseQuery: ModelQueryBuilderContract<typeof Case>) => {
        caseQuery.preload('client')
      })
    }

    if (options.withResponsible) {
      await deadline.load('responsible')
    }

    return deadline
  }
}
