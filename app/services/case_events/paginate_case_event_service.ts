import { inject } from '@adonisjs/core'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

import CaseEventsRepository from '#repositories/case_events_repository'
import CaseEvent from '#models/case_event'
import { PaginateOptions } from '#shared/lucid/lucid_repository_interface'

interface PaginateCaseEventsOptions extends PaginateOptions<typeof CaseEvent> {
  search?: string
  caseId?: number
  eventType?:
    | 'filing'
    | 'hearing'
    | 'decision'
    | 'publication'
    | 'appeal'
    | 'motion'
    | 'settlement'
    | 'judgment'
    | 'other'
  source?: 'manual' | 'court_api' | 'email' | 'import'
  createdBy?: number
  withCase?: boolean
  withCreator?: boolean
}

@inject()
export default class PaginateCaseEventService {
  constructor(private caseEventsRepository: CaseEventsRepository) {}

  /**
   * Paginate case events with advanced filters using model scopes
   * Provides comprehensive filtering for event management
   *
   * @param options - Pagination and filter options
   * @returns Paginated list of case events
   */
  async run(options: PaginateCaseEventsOptions): Promise<ModelPaginatorContract<CaseEvent>> {
    const {
      search,
      caseId,
      eventType,
      source,
      createdBy,
      withCase = false,
      withCreator = false,
      ...paginateOptions
    } = options

    const modifyQuery = (query: ModelQueryBuilderContract<typeof CaseEvent>) => {
      query.withScopes((scopes) => {
        // Text search
        if (search) {
          scopes.search(search)
        }

        // Filter by case
        if (caseId) {
          scopes.forCase(caseId)
        }

        // Filter by event type
        if (eventType) {
          scopes.byType(eventType)
        }

        // Filter by source
        if (source) {
          scopes.bySource(source)
        }

        // Filter by creator
        if (createdBy) {
          scopes.createdBy(createdBy)
        }

        // Include relationships
        if (withCase) {
          scopes.withCase()
        }

        if (withCreator) {
          scopes.withCreator()
        }

        // Default ordering by event date (reverse chronological)
        scopes.reverseChronological()
      })
    }

    paginateOptions.modifyQuery = paginateOptions.modifyQuery
      ? (query) => {
          paginateOptions.modifyQuery!(query)
          modifyQuery(query)
        }
      : modifyQuery

    return this.caseEventsRepository.paginate(paginateOptions) as Promise<
      ModelPaginatorContract<CaseEvent>
    >
  }
}
