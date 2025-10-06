import { DateTime } from 'luxon'
import CaseEvent from '#models/case_event'

/**
 * Service for creating case events
 *
 * This service handles case event creation with automatic defaults for:
 * - created_by: Set from the createdBy parameter
 * - source: Defaults to 'manual'
 * - event_date: Converted from Date to DateTime
 *
 * @example
 * const event = await createCaseEventService.run(payload, userId)
 */
export default class CreateCaseEventService {
  /**
   * Create a new case event with automatic defaults
   *
   * @param payload - Case event creation payload
   * @param createdBy - ID of the user creating the event
   * @returns Promise<CaseEvent> - The created case event
   */
  async run(
    payload: {
      case_id: number
      event_type:
        | 'filing'
        | 'hearing'
        | 'decision'
        | 'publication'
        | 'appeal'
        | 'motion'
        | 'settlement'
        | 'judgment'
        | 'other'
      title: string
      description?: string | null
      event_date: Date
      metadata?: Record<string, any> | null
    },
    createdBy: number
  ): Promise<CaseEvent> {
    // Convert event_date from Date to DateTime
    const eventDateTime = DateTime.fromJSDate(payload.event_date)

    // Set automatic defaults
    const eventData = {
      ...payload,
      event_date: eventDateTime,
      created_by: createdBy,
      source: 'manual' as const,
    }

    return await CaseEvent.create(eventData as any)
  }
}
