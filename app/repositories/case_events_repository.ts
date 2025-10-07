import { inject } from '@adonisjs/core'
import CaseEvent from '#models/case_event'
import ICaseEvent from '#interfaces/case_event_interface'
import LucidRepository from '#shared/lucid/lucid_repository'
import { DateTime } from 'luxon'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

@inject()
export default class CaseEventsRepository
  extends LucidRepository<typeof CaseEvent>
  implements ICaseEvent.Repository
{
  constructor() {
    super(CaseEvent)
  }

  /**
   * Find case events by case ID
   * @param caseId
   */
  async findByCaseId(caseId: number): Promise<CaseEvent[]> {
    return await this.model.query().where('case_id', caseId).orderBy('event_date', 'desc')
  }

  /**
   * Find case events by event type
   * @param eventType
   */
  async findByEventType(eventType: string): Promise<CaseEvent[]> {
    return await this.model.query().where('event_type', eventType).orderBy('event_date', 'desc')
  }

  /**
   * Find case events by source
   * @param source
   */
  async findBySource(source: string): Promise<CaseEvent[]> {
    return await this.model.query().where('source', source).orderBy('event_date', 'desc')
  }

  /**
   * Find case events by creator
   * @param createdBy
   */
  async findByCreator(createdBy: number): Promise<CaseEvent[]> {
    return await this.model.query().where('created_by', createdBy).orderBy('event_date', 'desc')
  }

  /**
   * Find case events between dates
   * @param from
   * @param to
   */
  async findBetweenDates(from: DateTime, to: DateTime): Promise<CaseEvent[]> {
    return await this.model
      .query()
      .whereBetween('event_date', [from.toISO()!, to.toISO()!])
      .orderBy('event_date', 'desc')
  }

  /**
   * Find upcoming case events
   * @param days - Number of days to look ahead
   */
  async findUpcoming(days: number): Promise<CaseEvent[]> {
    const now = DateTime.now()
    const future = now.plus({ days })
    return await this.model
      .query()
      .whereBetween('event_date', [now.toISO()!, future.toISO()!])
      .orderBy('event_date', 'asc')
  }

  /**
   * Find recent case events
   * @param days - Number of days to look back
   */
  async findRecent(days: number): Promise<CaseEvent[]> {
    const date = DateTime.now().minus({ days })
    return await this.model
      .query()
      .where('event_date', '>=', date.toISO()!)
      .orderBy('event_date', 'desc')
  }

  /**
   * Search case events with pagination
   * @param search - Search term to match against title, description
   * @param page - Page number
   * @param limit - Results per page
   */
  async searchCaseEvents(
    search: string,
    page: number,
    limit: number
  ): Promise<ModelPaginatorContract<CaseEvent>> {
    const query = this.model.query()

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`
      query.where((builder) => {
        builder.whereILike('title', searchTerm).orWhereILike('description', searchTerm)
      })
    }

    return await query.orderBy('event_date', 'desc').paginate(page, limit)
  }
}
