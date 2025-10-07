import { inject } from '@adonisjs/core'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

import DeadlinesRepository from '#repositories/deadlines_repository'
import Deadline from '#models/deadline'
import { PaginateOptions } from '#shared/lucid/lucid_repository_interface'

interface PaginateDeadlinesOptions extends PaginateOptions<typeof Deadline> {
  search?: string
  caseId?: number
  status?: 'pending' | 'completed' | 'expired' | 'cancelled'
  responsibleId?: number
  isFatal?: boolean
  withCase?: boolean
  withResponsible?: boolean
}

@inject()
export default class PaginateDeadlineService {
  constructor(private deadlinesRepository: DeadlinesRepository) {}

  /**
   * Paginate deadlines with advanced filters using model scopes
   * Provides comprehensive filtering for deadline management
   *
   * @param options - Pagination and filter options
   * @returns Paginated list of deadlines
   */
  async run(options: PaginateDeadlinesOptions): Promise<ModelPaginatorContract<Deadline>> {
    const {
      search,
      caseId,
      status,
      responsibleId,
      isFatal,
      withCase = false,
      withResponsible = false,
      ...paginateOptions
    } = options

    const modifyQuery = (query: ModelQueryBuilderContract<typeof Deadline>) => {
      query.withScopes((scopes) => {
        // Text search
        if (search) {
          scopes.search(search)
        }

        // Filter by case
        if (caseId) {
          scopes.forCase(caseId)
        }

        // Filter by status
        if (status) {
          scopes.byStatus(status)
        }

        // Filter by responsible user
        if (responsibleId) {
          scopes.assignedTo(responsibleId)
        }

        // Filter by fatal status
        if (isFatal !== undefined) {
          isFatal ? scopes.fatal() : scopes.nonFatal()
        }

        // Include relationships
        if (withCase) {
          scopes.withCase()
        }

        if (withResponsible) {
          scopes.withResponsible()
        }

        // Default ordering by deadline date (ascending)
        scopes.byDeadlineOrder()
      })
    }

    paginateOptions.modifyQuery = paginateOptions.modifyQuery
      ? (query) => {
          paginateOptions.modifyQuery!(query)
          modifyQuery(query)
        }
      : modifyQuery

    return this.deadlinesRepository.paginate(paginateOptions) as Promise<
      ModelPaginatorContract<Deadline>
    >
  }

  /**
   * Get upcoming deadlines within specified days
   * Used for deadline alerts and dashboard widgets
   *
   * @param days - Number of days to look ahead (default: 7)
   * @returns Array of upcoming deadlines
   */
  async getUpcoming(days: number = 7): Promise<Deadline[]> {
    return await this.deadlinesRepository.findUpcoming(days)
  }
}
