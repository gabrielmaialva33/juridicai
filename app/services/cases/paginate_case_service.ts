import { inject } from '@adonisjs/core'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import Case from '#models/case'
import CasesRepository from '#repositories/cases_repository'
import { PaginateOptions } from '#shared/lucid/lucid_repository_interface'

interface PaginateCasesOptions extends PaginateOptions<typeof Case> {
  search?: string
  status?:
    | 'active'
    | 'closed'
    | 'archived'
    | 'suspended'
    | Array<'active' | 'closed' | 'archived' | 'suspended'>
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  caseType?: 'civil' | 'criminal' | 'labor' | 'family' | 'tax' | 'administrative' | 'other'
  court?: string
  clientId?: number
  assignedTo?: number
  unassigned?: boolean
  requiresAttention?: boolean
  withUpcomingDeadlines?: number
  withRelationships?: boolean
  withDeadlinesCount?: boolean
  withDocumentsCount?: boolean
  orderByPriority?: boolean
}

@inject()
export default class PaginateCaseService {
  constructor(private casesRepository: CasesRepository) {}

  /**
   * Paginate cases with advanced filters using model scopes
   * Provides comprehensive filtering for case management
   *
   * @param options - Pagination and filter options
   * @returns Paginated list of cases
   */
  async run(options: PaginateCasesOptions): Promise<ModelPaginatorContract<Case>> {
    const {
      search,
      status,
      priority,
      caseType,
      court,
      clientId,
      assignedTo,
      unassigned = false,
      requiresAttention = false,
      withUpcomingDeadlines,
      withRelationships = false,
      withDeadlinesCount = false,
      withDocumentsCount = false,
      orderByPriority = false,
      ...paginateOptions
    } = options

    const modifyQuery = (query: ModelQueryBuilderContract<typeof Case>) => {
      query.withScopes((scopes) => {
        // Text search
        if (search) {
          scopes.search(search)
        }

        // Status filters
        if (status) {
          scopes.byStatus(status)
        }

        // Priority filters
        if (priority) {
          if (priority === 'urgent') {
            scopes.urgent()
          } else {
            scopes.byPriority(priority)
          }
        }

        // Case type filter
        if (caseType) {
          scopes.byType(caseType)
        }

        // Court filter
        if (court) {
          scopes.byCourt(court)
        }

        // Client filter
        if (clientId) {
          scopes.forClient(clientId)
        }

        // Assignment filters
        if (assignedTo) {
          scopes.assignedTo(assignedTo)
        }

        if (unassigned) {
          scopes.unassigned()
        }

        // Special filters
        if (requiresAttention) {
          scopes.requiresAttention()
        }

        if (withUpcomingDeadlines) {
          scopes.withUpcomingDeadlines(withUpcomingDeadlines)
        }

        // Relationships
        if (withRelationships) {
          scopes.withRelationships()
        } else {
          if (withDeadlinesCount) {
            scopes.withDeadlinesCount()
          }

          if (withDocumentsCount) {
            scopes.withDocumentsCount()
          }
        }

        // Ordering
        if (orderByPriority) {
          scopes.byPriorityOrder()
        } else {
          scopes.newest()
        }
      })
    }

    paginateOptions.modifyQuery = paginateOptions.modifyQuery
      ? (query) => {
          paginateOptions.modifyQuery!(query)
          modifyQuery(query)
        }
      : modifyQuery

    return this.casesRepository.paginate(paginateOptions) as Promise<ModelPaginatorContract<Case>>
  }

  /**
   * Get cases that require immediate attention
   *
   * @param page - Page number
   * @param perPage - Results per page
   * @returns Paginated list of urgent cases
   */
  async getUrgentCases(
    page: number = 1,
    perPage: number = 20
  ): Promise<ModelPaginatorContract<Case>> {
    const query = Case.query()

    query.withScopes((scopes) => {
      scopes.requiresAttention()
      scopes.active()
      scopes.withDeadlinesCount()
      scopes.withDocumentsCount()
      scopes.byPriorityOrder()
    })

    query.preload('client')
    query.preload('responsible_lawyer')

    return query.paginate(page, perPage)
  }

  /**
   * Get cases with upcoming deadlines
   *
   * @param days - Days to look ahead for deadlines
   * @param page - Page number
   * @param perPage - Results per page
   * @returns Paginated list of cases with upcoming deadlines
   */
  async getCasesWithUpcomingDeadlines(
    days: number = 7,
    page: number = 1,
    perPage: number = 20
  ): Promise<ModelPaginatorContract<Case>> {
    const query = Case.query()

    query.withScopes((scopes) => {
      scopes.withUpcomingDeadlines(days)
      scopes.active()
      scopes.byPriorityOrder()
    })

    query.preload('client')
    query.preload('responsible_lawyer')
    query.preload('deadlines', (deadlineQuery) => {
      deadlineQuery
        .withScopes((deadlineScopes) => {
          deadlineScopes.upcoming(days)
          deadlineScopes.byDeadlineOrder()
        })
        .limit(5)
    })

    return query.paginate(page, perPage)
  }

  /**
   * Get cases for a specific client
   *
   * @param clientId - Client ID
   * @param options - Additional filter options
   * @returns List of client's cases
   */
  async getClientCases(
    clientId: number,
    options: {
      status?:
        | 'active'
        | 'closed'
        | 'archived'
        | 'suspended'
        | Array<'active' | 'closed' | 'archived' | 'suspended'>
      withDocuments?: boolean
      limit?: number
    } = {}
  ): Promise<Case[]> {
    const { status, withDocuments = false, limit = 50 } = options

    const query = Case.query()

    query.withScopes((scopes) => {
      scopes.forClient(clientId)

      if (status) {
        scopes.byStatus(status)
      }

      if (withDocuments) {
        scopes.withRelationships()
      } else {
        scopes.withDeadlinesCount()
        scopes.withDocumentsCount()
      }

      scopes.newest()
    })

    if (!withDocuments) {
      query.preload('client')
      query.preload('responsible_lawyer')
    }

    if (limit) {
      query.limit(limit)
    }

    return query.exec()
  }

  /**
   * Get cases assigned to a specific user
   *
   * @param userId - User ID
   * @param activeOnly - Only return active cases
   * @param page - Page number
   * @param perPage - Results per page
   * @returns Paginated list of assigned cases
   */
  async getUserCases(
    userId: number,
    activeOnly: boolean = true,
    page: number = 1,
    perPage: number = 20
  ): Promise<ModelPaginatorContract<Case>> {
    const query = Case.query()

    query.withScopes((scopes) => {
      scopes.assignedTo(userId)

      if (activeOnly) {
        scopes.active()
      }

      scopes.withDeadlinesCount()
      scopes.withDocumentsCount()
      scopes.byPriorityOrder()
    })

    query.preload('client')

    return query.paginate(page, perPage)
  }

  /**
   * Search cases with simple search term
   *
   * @param search - Search term
   * @param page - Page number
   * @param perPage - Results per page
   * @returns Paginated search results
   */
  async search(
    search: string,
    page: number = 1,
    perPage: number = 20
  ): Promise<ModelPaginatorContract<Case>> {
    const query = Case.query()

    query.withScopes((scopes) => {
      scopes.search(search)
      scopes.withDeadlinesCount()
      scopes.withDocumentsCount()
      scopes.newest()
    })

    query.preload('client')
    query.preload('responsible_lawyer')

    return query.paginate(page, perPage)
  }
}
