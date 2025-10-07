import { inject } from '@adonisjs/core'
import CaseEvent from '#models/case_event'
import CaseEventsRepository from '#repositories/case_events_repository'

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
   * @returns Promise<CaseEvent | null> - The case event or null if not found
   */
  async run(
    eventId: number,
    options: {
      withCase?: boolean
    } = {}
  ): Promise<CaseEvent | null> {
    const event = await this.caseEventsRepository.findBy('id', eventId)

    if (!event) {
      return null
    }

    // Load relationships if requested
    if (options.withCase) {
      await (event as any).load('case', (caseQuery: any) => {
        caseQuery.preload('client')
      })
    }

    return event
  }
}
