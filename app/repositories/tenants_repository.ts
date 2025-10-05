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
    return this.model.query().where('subdomain', subdomain).first()
  }

  /**
   * Find a tenant by custom domain
   * @param customDomain - The custom domain to search for
   * @returns The tenant if found, null otherwise
   */
  async findByCustomDomain(customDomain: string): Promise<Tenant | null> {
    return this.model.query().where('custom_domain', customDomain).first()
  }

  /**
   * Find all active tenants by plan
   * @param plan - The plan type to filter by
   * @returns Array of active tenants with the specified plan
   */
  async findActiveByPlan(plan: string): Promise<Tenant[]> {
    return this.model.query().where('plan', plan).where('is_active', true).exec()
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
    const query = this.model.query()

    if (search && search.trim()) {
      query.where((builder) => {
        builder.whereILike('name', `%${search}%`).orWhereILike('subdomain', `%${search}%`)
      })
    }

    return query.orderBy('created_at', 'desc').paginate(page, limit)
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
  }): Promise<ModelPaginatorContract<Tenant>> {
    const {
      isActive,
      plan,
      search,
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = options

    const query = this.model.query()

    // Apply filters
    if (isActive !== undefined) {
      query.where('is_active', isActive)
    }

    if (plan) {
      query.where('plan', plan)
    }

    if (search) {
      query.where((subQuery) => {
        subQuery
          .whereLike('name', `%${search}%`)
          .orWhereLike('subdomain', `%${search}%`)
          .orWhereLike('custom_domain', `%${search}%`)
      })
    }

    // Apply sorting
    query.orderBy(sortBy, sortOrder)

    // Paginate
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
      .whereHas('tenant_users', (tenantUserQuery) => {
        tenantUserQuery.where('user_id', userId).where('is_active', true)
      })
      .where('is_active', true)
      .orderBy('created_at', 'desc')
  }
}
