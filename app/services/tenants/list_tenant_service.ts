import { inject } from '@adonisjs/core'
import Tenant from '#models/tenant'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

interface ListTenantsFilters {
  is_active?: boolean
  plan?: 'free' | 'starter' | 'pro' | 'enterprise'
  search?: string
}

interface ListTenantsOptions {
  page?: number
  limit?: number
  sortBy?: 'created_at' | 'name' | 'subdomain'
  sortOrder?: 'asc' | 'desc'
}

@inject()
export default class ListTenantsService {
  /**
   * List tenants with filters and pagination
   */
  async execute(
    filters: ListTenantsFilters = {},
    options: ListTenantsOptions = {}
  ): Promise<ModelPaginatorContract<Tenant>> {
    const { is_active, plan, search } = filters
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc' } = options

    const query = Tenant.query()

    // Apply filters
    if (is_active !== undefined) {
      query.where('is_active', is_active)
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
    const tenants = await query.paginate(page, limit)

    return tenants
  }

  /**
   * Get all tenants for a specific user
   */
  async forUser(userId: number): Promise<Tenant[]> {
    const tenants = await Tenant.query()
      .whereHas('tenant_users', (tenantUserQuery) => {
        tenantUserQuery.where('user_id', userId).where('is_active', true)
      })
      .where('is_active', true)
      .orderBy('created_at', 'desc')

    return tenants
  }
}
