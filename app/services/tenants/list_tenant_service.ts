import { inject } from '@adonisjs/core'
import Tenant from '#models/tenant'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import TenantsRepository from '#repositories/tenants_repository'

interface ListTenantsOptions {
  isActive?: boolean
  plan?: 'free' | 'starter' | 'pro' | 'enterprise'
  search?: string
  page?: number
  perPage?: number
  sortBy?: 'created_at' | 'name' | 'subdomain'
  sortOrder?: 'asc' | 'desc'
  withUserCount?: boolean
  inTrial?: boolean
  suspended?: boolean
}

@inject()
export default class ListTenantsService {
  constructor(private tenantsRepository: TenantsRepository) {}

  /**
   * List tenants with advanced filters and pagination
   * Now supports additional filters: withUserCount, inTrial, suspended
   *
   * @param options - Filter and pagination options
   * @returns Paginated list of tenants
   */
  async run(options: ListTenantsOptions = {}): Promise<ModelPaginatorContract<Tenant>> {
    const {
      isActive,
      plan,
      search,
      page = 1,
      perPage = 20,
      sortBy = 'created_at',
      sortOrder = 'desc',
      withUserCount = false,
      inTrial = false,
      suspended = false,
    } = options

    return this.tenantsRepository.listWithFilters({
      isActive,
      plan,
      search,
      page,
      limit: perPage,
      sortBy,
      sortOrder,
      withUserCount,
      inTrial,
      suspended,
    })
  }

  /**
   * Search tenants with simple search term
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
  ): Promise<ModelPaginatorContract<Tenant>> {
    return this.tenantsRepository.searchTenants(search, page, perPage)
  }

  /**
   * Get active tenants by plan
   *
   * @param plan - Tenant plan type
   * @returns List of active tenants with specified plan
   */
  async getActiveByPlan(plan: 'free' | 'starter' | 'pro' | 'enterprise'): Promise<Tenant[]> {
    return this.tenantsRepository.findActiveByPlan(plan)
  }

  /**
   * Get tenants for a specific user
   *
   * @param userId - User ID
   * @param paginate - Whether to paginate results
   * @param page - Page number (if paginating)
   * @param perPage - Results per page (if paginating)
   * @param withUserCount - Include user count
   * @returns List or paginated list of user's tenants
   */
  async getUserTenants(
    userId: number,
    paginate: boolean = false,
    page: number = 1,
    perPage: number = 10,
    withUserCount: boolean = false
  ): Promise<Tenant[] | ModelPaginatorContract<Tenant>> {
    if (paginate) {
      return this.tenantsRepository.findByUserIdPaginated(
        userId,
        page,
        perPage,
        'created_at',
        'desc',
        withUserCount
      )
    }
    return this.tenantsRepository.findByUserId(userId)
  }
}
