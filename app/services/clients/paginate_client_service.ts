import { inject } from '@adonisjs/core'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

import ClientsRepository from '#repositories/clients_repository'
import Client from '#models/client'
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
    }

    paginateOptions.modifyQuery = paginateOptions.modifyQuery
      ? (query) => {
          paginateOptions.modifyQuery!(query)
          modifyQuery(query)
        }
      : modifyQuery

    return this.clientsRepository.paginate(paginateOptions) as Promise<
      ModelPaginatorContract<Client>
    >
  }
}
