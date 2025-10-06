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
}
