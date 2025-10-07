import LucidRepositoryInterface from '#shared/lucid/lucid_repository_interface'
import CaseEvent from '#models/case_event'
import { DateTime } from 'luxon'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

namespace ICaseEvent {
  export interface Repository extends LucidRepositoryInterface<typeof CaseEvent> {
    /**
     * Find case events by case ID
     * @param caseId
     */
    findByCaseId(caseId: number): Promise<CaseEvent[]>

    /**
     * Find case events by event type
     * @param eventType
     */
    findByEventType(eventType: string): Promise<CaseEvent[]>

    /**
     * Find case events by source
     * @param source
     */
    findBySource(source: string): Promise<CaseEvent[]>

    /**
     * Find case events by creator
     * @param createdBy
     */
    findByCreator(createdBy: number): Promise<CaseEvent[]>

    /**
     * Find case events between dates
     * @param from
     * @param to
     */
    findBetweenDates(from: DateTime, to: DateTime): Promise<CaseEvent[]>

    /**
     * Find upcoming case events
     * @param days - Number of days to look ahead
     */
    findUpcoming(days: number): Promise<CaseEvent[]>

    /**
     * Find recent case events
     * @param days - Number of days to look back
     */
    findRecent(days: number): Promise<CaseEvent[]>

    /**
     * Search case events with pagination
     * @param search - Search term to match against title, description
     * @param page - Page number
     * @param limit - Results per page
     */
    searchCaseEvents(
      search: string,
      page: number,
      limit: number
    ): Promise<ModelPaginatorContract<CaseEvent>>
  }

  export interface CreatePayload {
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
    event_date: DateTime | Date
    source?: 'manual' | 'court_api' | 'email' | 'import'
    metadata?: Record<string, any> | null
    created_by?: number | null
  }

  export interface EditPayload {
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
    event_date?: DateTime | Date
    source?: 'manual' | 'court_api' | 'email' | 'import'
    metadata?: Record<string, any> | null
  }

  export interface FilterPayload {
    case_id?: number
    event_type?: string
    source?: string
    created_by?: number
    from_date?: DateTime
    to_date?: DateTime
  }
}

export default ICaseEvent
