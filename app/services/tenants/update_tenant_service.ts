import { inject } from '@adonisjs/core'
import Tenant from '#models/tenant'
import TenantsRepository from '#repositories/tenants_repository'

interface UpdateTenantData {
  name?: string
  subdomain?: string
  custom_domain?: string | null
  plan?: 'free' | 'starter' | 'pro' | 'enterprise'
  is_active?: boolean
  limits?: {
    max_users?: number
    max_cases?: number
    max_storage_gb?: number
    max_documents?: number
  }
  suspended_reason?: string | null
}

@inject()
export default class UpdateTenantService {
  constructor(private tenantsRepository: TenantsRepository) {}

  /**
   * Update an existing tenant
   */
  async run(tenantId: string, data: UpdateTenantData): Promise<Tenant> {
    const tenant = await this.tenantsRepository.findBy('id', tenantId)
    if (!tenant) {
      throw new Error('Tenant not found')
    }

    // Validate subdomain uniqueness if changed
    if (data.subdomain && data.subdomain !== tenant.subdomain) {
      const existingTenant = await this.tenantsRepository.findBySubdomain(data.subdomain)
      if (existingTenant) {
        throw new Error(`Subdomain '${data.subdomain}' is already taken`)
      }
    }

    // Validate custom_domain uniqueness if changed
    if (data.custom_domain && data.custom_domain !== tenant.custom_domain) {
      const existingCustomDomain = await this.tenantsRepository.findByCustomDomain(
        data.custom_domain
      )
      if (existingCustomDomain) {
        throw new Error(`Custom domain '${data.custom_domain}' is already in use`)
      }
    }

    // Update tenant
    if (data.name !== undefined) tenant.name = data.name
    if (data.subdomain !== undefined) tenant.subdomain = data.subdomain
    if (data.custom_domain !== undefined) tenant.custom_domain = data.custom_domain
    if (data.plan !== undefined) tenant.plan = data.plan
    if (data.is_active !== undefined) {
      tenant.is_active = data.is_active
      // Set suspended_at timestamp when deactivating
      if (!data.is_active) {
        tenant.suspended_at = new Date() as any
      } else {
        tenant.suspended_at = null
        tenant.suspended_reason = null
      }
    }
    if (data.limits !== undefined) tenant.limits = data.limits
    if (data.suspended_reason !== undefined) tenant.suspended_reason = data.suspended_reason

    await tenant.save()

    return tenant
  }
}
