import { inject } from '@adonisjs/core'
import { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import Client from '#models/client'
import ClientsRepository from '#repositories/clients_repository'
import { PaginateOptions } from '#shared/lucid/lucid_repository_interface'

interface PaginateClientsOptions extends PaginateOptions<typeof Client> {
  search?: string
  clientType?: 'individual' | 'company'
  isActive?: boolean
  state?: string
  city?: string
  tags?: string[]
  withCases?: boolean
  withCasesCount?: boolean
  withActiveCases?: boolean
  withoutCases?: boolean
}

@inject()
export default class PaginateClientService {
  constructor(private clientsRepository: ClientsRepository) {}

  /**
   * Paginate clients with advanced filters using model scopes
   * Leverages the scopes defined in the Client model for cleaner queries
   *
   * @param options - Pagination and filter options
   * @returns Paginated list of clients
   */
  async run(options: PaginateClientsOptions): Promise<ModelPaginatorContract<Client>> {
    const {
      search,
      clientType,
      isActive, // No default - let it be undefined when not specified
      state,
      city,
      tags,
      withCases = false,
      withCasesCount = false,
      withActiveCases = false,
      withoutCases = false,
      ...paginateOptions
    } = options

    const modifyQuery = (query: ModelQueryBuilderContract<typeof Client>) => {
      // Apply scopes using withScopes for better readability and maintainability
      query.withScopes((scopes) => {
        // Search by name, CPF, CNPJ, email
        if (search) {
          scopes.search(search)
        }

        // Filter by client type
        if (clientType) {
          scopes.ofType(clientType)
        }

        // Filter active/inactive clients
        if (isActive !== undefined) {
          isActive ? scopes.active() : scopes.inactive()
        }

        // Filter by location
        if (state) {
          scopes.byState(state)
        }

        if (city) {
          scopes.byCity(city)
        }

        // Filter by tags
        if (tags && tags.length > 0) {
          if (tags.length === 1) {
            scopes.hasTag(tags[0])
          } else {
            scopes.hasAnyTag(tags)
          }
        }

        // Filter by case associations
        if (withActiveCases) {
          scopes.withActiveCases()
        }

        if (withoutCases) {
          scopes.withoutCases()
        }

        // Include relationships
        if (withCases) {
          scopes.withCases()
        }

        if (withCasesCount) {
          scopes.withCasesCount()
        }
      })

      // Apply default ordering outside of withScopes to avoid COUNT issues
      if (!options.sortBy) {
        query.orderBy('created_at', 'desc')
      }
    }

    // Build query directly instead of using repository.paginate
    // to avoid COUNT issues with complex scopes
    const query = Client.query()
    modifyQuery(query)

    // Apply custom modifyQuery if provided
    if (paginateOptions.modifyQuery) {
      paginateOptions.modifyQuery(query)
    }

    // Apply sorting
    if (paginateOptions.sortBy) {
      query.orderBy(paginateOptions.sortBy, paginateOptions.direction || 'asc')
    }

    // Manual pagination to avoid Lucid's paginate() COUNT bug with scopes
    const page = paginateOptions.page || 1
    const perPage = paginateOptions.perPage || 20

    // Get total count using cloned query with tenant scope applied
    const countQuery = query.clone().clearSelect().clearOrder()
    const totalResult = await countQuery.count('* as total').first()
    const total = Number(totalResult?.$extras?.total || 0)

    // Get paginated data
    const data = await query.offset((page - 1) * perPage).limit(perPage)

    // Build paginator response matching Lucid's format
    return {
      data,
      meta: {
        total,
        per_page: perPage,
        current_page: page,
        last_page: Math.ceil(total / perPage),
        first_page: 1,
        first_page_url: '',
        last_page_url: '',
        next_page_url: page < Math.ceil(total / perPage) ? '' : null,
        previous_page_url: page > 1 ? '' : null,
      },
    } as any
  }

  /**
   * Simple search for clients
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
  ): Promise<ModelPaginatorContract<Client>> {
    const query = Client.query()

    query.withScopes((scopes) => {
      scopes.search(search)
      scopes.active()
      scopes.withCasesCount()
      scopes.newest()
    })

    return query.paginate(page, perPage)
  }

  /**
   * Get recently added clients
   *
   * @param days - Number of days to look back
   * @param page - Page number
   * @param perPage - Results per page
   * @returns Paginated list of recent clients
   */
  async getRecentClients(
    days: number = 7,
    page: number = 1,
    perPage: number = 20
  ): Promise<ModelPaginatorContract<Client>> {
    const query = Client.query()

    query.withScopes((scopes) => {
      scopes.recent(days)
      scopes.active()
      scopes.withCasesCount()
      scopes.newest()
    })

    return query.paginate(page, perPage)
  }

  /**
   * Get clients by type with optional filters
   *
   * @param type - Client type (individual or company)
   * @param options - Additional filter options
   * @returns List of clients
   */
  async getByType(
    type: 'individual' | 'company',
    options: {
      state?: string
      tags?: string[]
      withCases?: boolean
      maxResults?: number
    } = {}
  ): Promise<Client[]> {
    const { state, tags, withCases, maxResults = 50 } = options

    const query = Client.query()

    query.withScopes((scopes) => {
      scopes.ofType(type)
      scopes.active()

      if (state) {
        scopes.byState(state)
      }

      if (tags && tags.length > 0) {
        scopes.hasAnyTag(tags)
      }

      if (withCases) {
        scopes.withCases()
      } else {
        scopes.withCasesCount()
      }

      scopes.alphabetical()
    })

    if (maxResults) {
      query.limit(maxResults)
    }

    return query.exec()
  }
}
