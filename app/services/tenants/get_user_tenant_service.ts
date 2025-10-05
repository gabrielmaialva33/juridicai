import { inject } from '@adonisjs/core'
import Tenant from '#models/tenant'
import TenantsRepository from '#repositories/tenants_repository'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

@inject()
export default class GetUserTenantsService {
  constructor(private tenantsRepository: TenantsRepository) {}

  /**
   * Get all active tenants for a specific user with pagination
   */
  async run(
    userId: number,
    page: number = 1,
    perPage: number = 10,
    sortBy: 'created_at' | 'name' | 'subdomain' = 'created_at',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<ModelPaginatorContract<Tenant>> {
    return this.tenantsRepository.findByUserIdPaginated(userId, page, perPage, sortBy, sortOrder)
  }
}
