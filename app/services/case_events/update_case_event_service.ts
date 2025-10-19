import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import CaseEvent from '#models/case_event'
import CaseEventsRepository from '#repositories/case_events_repository'
import NotFoundException from '#exceptions/not_found_exception'

/**
 * Service for updating an existing case event
 *
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
      event_date?: DateTime | Date | string
      source?: 'manual' | 'court_api' | 'email' | 'import'
      metadata?: Record<string, any> | null
    }
  ): Promise<CaseEvent> {
    const event = await this.caseEventsRepository.findBy('id', eventId)

    if (!event) {
      throw new NotFoundException('Case event not found')
    }

    // Convert event_date to DateTime if it's a Date or string
    const processedPayload = { ...payload }
    if (payload.event_date) {
      if (payload.event_date instanceof Date) {
        processedPayload.event_date = DateTime.fromJSDate(payload.event_date)
      } else if (typeof payload.event_date === 'string') {
        processedPayload.event_date = DateTime.fromISO(payload.event_date)
      }
    }

    event.merge(processedPayload)
    await event.save()

    return event
  }
}
