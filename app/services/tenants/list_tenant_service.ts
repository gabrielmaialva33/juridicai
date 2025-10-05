import { inject } from '@adonisjs/core'
import Tenant from '#models/tenant'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import TenantsRepository from '#repositories/tenants_repository'

@inject()
export default class ListTenantsService {
  constructor(private tenantsRepository: TenantsRepository) {}

  /**
   * List tenants with filters and pagination
   */
  async run(
    isActive?: boolean,
    plan?: 'free' | 'starter' | 'pro' | 'enterprise',
    search?: string,
    page: number = 1,
    limit: number = 20,
    sortBy: 'created_at' | 'name' | 'subdomain' = 'created_at',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<ModelPaginatorContract<Tenant>> {
    return this.tenantsRepository.listWithFilters({
      isActive,
      plan,
      search,
      page,
      limit,
      sortBy,
      sortOrder,
    })
  }
}
