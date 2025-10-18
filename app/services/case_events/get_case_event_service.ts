import { inject } from '@adonisjs/core'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import CaseEvent from '#models/case_event'
import Case from '#models/case'
import CaseEventsRepository from '#repositories/case_events_repository'
import NotFoundException from '#exceptions/not_found_exception'

/**
 * Service for retrieving a case event by ID with optional relationships
 *
 * Supports loading related data:
 * - withCase: Load the associated case (with client preloaded)
 *
 * @example
 * const event = await getCaseEventService.run(123, { withCase: true })
 */
@inject()
export default class GetCaseEventService {
  constructor(private caseEventsRepository: CaseEventsRepository) {}

  /**
   * Get a case event by ID with optional relationships
   *
   * @param eventId - The ID of the case event to retrieve
   * @param options - Options for loading relationships
   * @param options.withCase - Load the case relationship
   * @returns Promise<CaseEvent> - The case event instance
   * @throws {NotFoundException} if case event not found
   */
  async run(
    eventId: number,
    options: {
      withCase?: boolean
    } = {}
  ): Promise<CaseEvent> {
    const event = await this.caseEventsRepository.findBy('id', eventId)

    if (!event) {
      throw new NotFoundException('Case event not found')
    }

    // Load relationships if requested
    if (options.withCase) {
      await event.load('case', (caseQuery: ModelQueryBuilderContract<typeof Case>) => {
        caseQuery.preload('client')
      })
    }

    return event
  }
}
