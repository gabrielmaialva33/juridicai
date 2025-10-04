import { inject } from '@adonisjs/core'
import Tenant from '#models/tenant'
import TenantUser from '#models/tenant_user'
import User from '#models/user'
import { DateTime } from 'luxon'

interface CreateTenantData {
  name: string
  subdomain: string
  custom_domain?: string | null
  plan?: 'free' | 'starter' | 'pro' | 'enterprise'
  limits?: {
    max_users?: number
    max_cases?: number
    max_storage_gb?: number
    max_documents?: number
  }
  owner_user_id: number
}

@inject()
export default class CreateTenantService {
  /**
   * Create a new tenant and assign the owner
   */
  async execute(data: CreateTenantData): Promise<Tenant> {
    // Validate subdomain uniqueness
    const existingTenant = await Tenant.findBy('subdomain', data.subdomain)
    if (existingTenant) {
      throw new Error(`Subdomain '${data.subdomain}' is already taken`)
    }

    // Validate custom_domain uniqueness if provided
    if (data.custom_domain) {
      const existingCustomDomain = await Tenant.findBy('custom_domain', data.custom_domain)
      if (existingCustomDomain) {
        throw new Error(`Custom domain '${data.custom_domain}' is already in use`)
      }
    }

    // Validate owner exists
    const owner = await User.find(data.owner_user_id)
    if (!owner) {
      throw new Error('Owner user not found')
    }

    // Create tenant
    const tenant = await Tenant.create({
      name: data.name,
      subdomain: data.subdomain,
      custom_domain: data.custom_domain ?? null,
      plan: data.plan ?? 'free',
      is_active: true,
      limits: data.limits ?? null,
      trial_ends_at: DateTime.now().plus({ days: 14 }), // 14 day trial
    })

    // Assign owner to tenant
    await TenantUser.create({
      tenant_id: tenant.id,
      user_id: owner.id,
      role: 'owner',
      is_active: true,
      invited_at: DateTime.now(),
      joined_at: DateTime.now(),
    })

    return tenant
  }
}
