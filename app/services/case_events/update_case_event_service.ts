import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import CaseEvent from '#models/case_event'
import CaseEventsRepository from '#repositories/case_events_repository'
import NotFoundException from '#exceptions/not_found_exception'

/**
 * Service for updating an existing case event
 *
 * Converts event_date from Date to DateTime if provided
 * Uses merge() and save() pattern for updates
 *
 * @example
 * const updated = await updateCaseEventService.run(123, { title: 'New Title' })
 */
@inject()
export default class UpdateCaseEventService {
  constructor(private caseEventsRepository: CaseEventsRepository) {}

  /**
   * Update a case event by ID
   *
   * @param eventId - The ID of the case event to update
   * @param payload - The fields to update
   * @returns Promise<CaseEvent> - The updated case event
   * @throws {NotFoundException} if case event not found
   */
  async run(
    eventId: number,
    payload: {
      case_id?: number
      event_type?:
        | 'filing'
        | 'hearing'
        | 'decision'
        | 'publication'
        | 'appeal'
        | 'motion'
        | 'settlement'
        | 'judgment'
        | 'other'
      title?: string
      description?: string | null
      event_date?: Date
      source?: 'manual' | 'court_api' | 'email' | 'import'
      metadata?: Record<string, any> | null
    }
  ): Promise<CaseEvent> {
    const event = await this.caseEventsRepository.findBy('id', eventId)

    if (!event) {
      throw new NotFoundException('Case event not found')
    }

    // Convert event_date if provided
    if (payload.event_date) {
      const eventDateTime = DateTime.fromJSDate(payload.event_date)
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { event_date, ...rest } = payload
      event.merge(rest as any)
      event.event_date = eventDateTime
    } else {
      event.merge(payload as any)
    }

    await event.save()

    return event
  }
}
