import { inject } from '@adonisjs/core'
import Client from '#models/client'
import IClient from '#interfaces/client_interface'
import LucidRepository from '#shared/lucid/lucid_repository'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import { PaginateOptions, PaginateResult } from '#shared/lucid/lucid_repository_interface'

@inject()
export default class ClientsRepository
  extends LucidRepository<typeof Client>
  implements IClient.Repository
{
  constructor() {
    super(Client)
  }

  /**
   * Override paginate to fix Lucid ORM bug where COUNT query doesn't respect withScopes()
   * This ensures accurate total counts when using model scopes for filtering
   */
  async paginate(options: PaginateOptions<typeof Client>): Promise<PaginateResult<typeof Client>> {
    const query = this.buildQuery({ opts: options })

    query.orderBy(options.sortBy || this.DEFAULT_SORT, options.direction || this.DEFAULT_DIRECTION)

    // Manual pagination to avoid Lucid's paginate() COUNT bug with scopes
    const page = options.page || this.DEFAULT_PAGE
    const perPage = options.perPage || this.DEFAULT_PER_PAGE

    // Get total count using a cloned query with all scopes applied
    const countQuery = query.clone().clearSelect().clearOrder()
    const totalResult = await countQuery.count('* as total').first()
    const total = Number(totalResult?.$extras?.total || 0)

    // Get paginated data
    const data = await query.offset((page - 1) * perPage).limit(perPage)

    // Build paginator response matching Lucid's ModelPaginatorContract format
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
   * Find a client by CPF
   * @param cpf - The CPF to search for
   * @returns The client if found, null otherwise
   */
  async findByCpf(cpf: string): Promise<Client | null> {
    return this.model.query().where('cpf', cpf).first()
  }

  /**
   * Find a client by CNPJ
   * @param cnpj - The CNPJ to search for
   * @returns The client if found, null otherwise
   */
  async findByCnpj(cnpj: string): Promise<Client | null> {
    return this.model.query().where('cnpj', cnpj).first()
  }

  /**
   * Find a client by email
   * @param email - The email to search for
   * @returns The client if found, null otherwise
   */
  async findByEmail(email: string): Promise<Client | null> {
    return this.model.query().where('email', email).first()
  }

  /**
   * Search clients with pagination
   * @param search - Search term to match against name, CPF, CNPJ, email
   * @param page - Page number (1-based)
   * @param limit - Number of results per page
   * @returns Paginated results of matching clients
   */
  async searchClients(
    search: string,
    page: number,
    limit: number
  ): Promise<ModelPaginatorContract<Client>> {
    return this.model
      .query()
      .withScopes((scopes) => {
        scopes.search(search)
        scopes.active()
        scopes.newest()
      })
      .paginate(page, limit)
  }

  /**
   * Find clients by tags
   * @param tags - Array of tags to filter by
   * @returns Array of clients matching any of the tags
   */
  async findByTags(tags: string[]): Promise<Client[]> {
    return this.model
      .query()
      .withScopes((scopes) => {
        scopes.hasAnyTag(tags)
        scopes.active()
        scopes.alphabetical()
      })
      .exec()
  }

  /**
   * Find clients by state
   * @param state - State code (e.g., 'SP', 'RJ')
   * @returns Array of clients in the specified state
   */
  async findByState(state: string): Promise<Client[]> {
    return this.model
      .query()
      .withScopes((scopes) => {
        scopes.byState(state)
        scopes.active()
        scopes.alphabetical()
      })
      .exec()
  }

  /**
   * Get recently created clients
   * @param days - Number of days to look back
   * @returns Array of clients created within the specified days
   */
  async getRecentClients(days: number): Promise<Client[]> {
    return this.model
      .query()
      .withScopes((scopes) => {
        scopes.recent(days)
        scopes.active()
        scopes.newest()
      })
      .exec()
  }
}
