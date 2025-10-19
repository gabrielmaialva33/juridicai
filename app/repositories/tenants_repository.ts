import Tenant from '#models/tenant'
import ITenant from '#interfaces/tenant_interface'
import LucidRepository from '#shared/lucid/lucid_repository'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

export default class TenantsRepository
  extends LucidRepository<typeof Tenant>
  implements ITenant.Repository
{
  constructor() {
    super(Tenant)
  }

  /**
   * Find a tenant by subdomain
   * @param subdomain - The subdomain to search for
   * @returns The tenant if found, null otherwise
   */
  async findBySubdomain(subdomain: string): Promise<Tenant | null> {
    return this.model
      .query()
      .withScopes((scopes) => scopes.bySubdomain(subdomain))
      .first()
  }

  /**
   * Find a tenant by custom domain
   * @param customDomain - The custom domain to search for
   * @returns The tenant if found, null otherwise
   */
  async findByCustomDomain(customDomain: string): Promise<Tenant | null> {
    return this.model
      .query()
      .withScopes((scopes) => scopes.byCustomDomain(customDomain))
      .first()
  }

  /**
   * Find all active tenants by plan
   * @param plan - The plan type to filter by
   * @returns Array of active tenants with the specified plan
   */
  async findActiveByPlan(plan: 'free' | 'starter' | 'pro' | 'enterprise'): Promise<Tenant[]> {
    return this.model.query().withScopes((scopes) => {
      scopes.active()
      scopes.byPlan(plan)
    })
  }

  /**
   * Search tenants with pagination
   * @param search - Search term to match against tenant name or subdomain
   * @param page - Page number (1-based)
   * @param limit - Number of results per page
   * @returns Paginated results of matching tenants
   */
  async searchTenants(
    search: string,
    page: number,
    limit: number
  ): Promise<ModelPaginatorContract<Tenant>> {
    return this.model
      .query()
      .withScopes((scopes) => {
        if (search && search.trim()) {
          scopes.search(search)
        }
        scopes.newest()
      })
      .paginate(page, limit)
  }

  /**
   * List tenants with advanced filters and pagination
   * @param options - Filtering and pagination options
   * @returns Paginated results of matching tenants
   */
  async listWithFilters(options: {
    isActive?: boolean
    plan?: 'free' | 'starter' | 'pro' | 'enterprise'
    search?: string
    page?: number
    limit?: number
    sortBy?: 'created_at' | 'name' | 'subdomain'
    sortOrder?: 'asc' | 'desc'
    withUserCount?: boolean
    inTrial?: boolean
    suspended?: boolean
  }): Promise<ModelPaginatorContract<Tenant>> {
    const {
      isActive,
      plan,
      search,
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc',
      withUserCount = false,
      inTrial = false,
      suspended = false,
    } = options

    const query = this.model.query()

    // Exclude system tenant from regular listings
    query.whereNot('subdomain', 'system')

    query.withScopes((scopes) => {
      // Apply filters using tenant scopes
      if (isActive === true) {
        scopes.active()
      }

      if (plan) {
        scopes.byPlan(plan)
      }

      if (search) {
        scopes.search(search)
      }

      if (inTrial) {
        scopes.inTrial()
      }

      if (suspended) {
        scopes.suspended()
      }

      if (withUserCount) {
        scopes.withUserCount()
      }

      // Apply sorting using scopes where available
      if (sortBy === 'created_at' && sortOrder === 'desc') {
        scopes.newest()
      } else if (sortBy === 'name' && sortOrder === 'asc') {
        scopes.alphabetical()
      }
    })

    // Handle non-scope filters and sorting
    if (isActive === false) {
      query.where('is_active', false)
    }

    // Apply custom sorting if not handled by scopes
    if (
      !(sortBy === 'created_at' && sortOrder === 'desc') &&
      !(sortBy === 'name' && sortOrder === 'asc')
    ) {
      query.orderBy(sortBy, sortOrder)
    }

    return query.paginate(page, limit)
  }

  /**
   * Find all active tenants for a specific user
   * @param userId - The user ID to search for
   * @returns Array of active tenants where the user is an active member
   */
  async findByUserId(userId: number): Promise<Tenant[]> {
    return this.model
      .query()
      .withScopes((scopes) => {
        scopes.active()
        scopes.newest()
      })
      .whereHas('tenant_users', (tenantUserQuery) => {
        tenantUserQuery.where('user_id', userId).where('is_active', true)
      })
  }

  /**
   * Find active tenants for a specific user with pagination
   * @param userId - The user ID to search for
   * @param page - Page number (1-based)
   * @param perPage - Number of results per page
   * @param sortBy - Column to sort by
   * @param sortOrder - Sort direction
   * @param withUserCount - Include users count
   * @returns Paginated results of active tenants where the user is an active member
   */
  async findByUserIdPaginated(
    userId: number,
    page: number = 1,
    perPage: number = 10,
    sortBy: 'created_at' | 'name' | 'subdomain' = 'created_at',
    sortOrder: 'asc' | 'desc' = 'desc',
    withUserCount: boolean = false
  ): Promise<ModelPaginatorContract<Tenant>> {
    const query = this.model.query()

    query.withScopes((scopes) => {
      scopes.active()

      if (withUserCount) {
        scopes.withUserCount()
      }

      // Apply sorting using scopes where available
      if (sortBy === 'created_at' && sortOrder === 'desc') {
        scopes.newest()
      } else if (sortBy === 'name' && sortOrder === 'asc') {
        scopes.alphabetical()
      }
    })

    // Filter by user's active tenants
    query.whereHas('tenant_users', (tenantUserQuery) => {
      tenantUserQuery.where('user_id', userId).where('is_active', true)
    })

    // Apply custom sorting if not handled by scopes
    if (
      !(sortBy === 'created_at' && sortOrder === 'desc') &&
      !(sortBy === 'name' && sortOrder === 'asc')
    ) {
      query.orderBy(sortBy, sortOrder)
    }

    return query.paginate(page, perPage)
  }
}
