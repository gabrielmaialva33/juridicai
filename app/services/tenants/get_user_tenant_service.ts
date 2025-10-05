import { inject } from '@adonisjs/core'
import Tenant from '#models/tenant'
import TenantsRepository from '#repositories/tenants_repository'

@inject()
export default class GetUserTenantsService {
  constructor(private tenantsRepository: TenantsRepository) {}

  /**
   * Get all active tenants for a specific user
   */
  async run(userId: number): Promise<Tenant[]> {
    return this.tenantsRepository.findByUserId(userId)
  }
}
