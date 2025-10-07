import { inject } from '@adonisjs/core'
import Tenant from '#models/tenant'
import TenantsRepository from '#repositories/tenants_repository'

interface GetTenantOptions {
  withUserCount?: boolean
}

@inject()
export default class GetTenantService {
  constructor(private tenantsRepository: TenantsRepository) {}

  /**
   * Get a single tenant by ID with optional relationships
   */
  async run(tenantId: string, options: GetTenantOptions = {}): Promise<Tenant | null> {
    const tenant = await this.tenantsRepository.findBy('id', tenantId)

    if (!tenant) {
      return null
    }

    // Load relationships if requested
    if (options.withUserCount) {
      await tenant.loadCount('tenant_users')
    }

    return tenant
  }
}
