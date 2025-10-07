import { inject } from '@adonisjs/core'
import Tenant from '#models/tenant'
import { TenantUserRole } from '#models/tenant_user'
import { DateTime } from 'luxon'
import TenantsRepository from '#repositories/tenants_repository'
import UsersRepository from '#repositories/users_repository'
import TenantUsersRepository from '#repositories/tenant_users_repository'
import ConflictException from '#exceptions/conflict_exception'
import NotFoundException from '#exceptions/not_found_exception'

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
  constructor(
    private tenantsRepository: TenantsRepository,
    private usersRepository: UsersRepository,
    private tenantUsersRepository: TenantUsersRepository
  ) {}

  /**
   * Create a new tenant and assign the owner
   */
  async run(data: CreateTenantData): Promise<Tenant> {
    // Validate subdomain uniqueness
    const existingTenant = await this.tenantsRepository.findBySubdomain(data.subdomain)
    if (existingTenant) {
      throw new ConflictException(`Subdomain '${data.subdomain}' is already taken`)
    }

    // Validate custom_domain uniqueness if provided
    if (data.custom_domain) {
      const existingCustomDomain = await this.tenantsRepository.findByCustomDomain(
        data.custom_domain
      )
      if (existingCustomDomain) {
        throw new ConflictException(`Custom domain '${data.custom_domain}' is already in use`)
      }
    }

    // Validate owner exists
    const owner = await this.usersRepository.findBy('id', data.owner_user_id)
    if (!owner) {
      throw new NotFoundException('Owner user not found')
    }

    // Create tenant
    const tenant = await this.tenantsRepository.create({
      name: data.name,
      subdomain: data.subdomain,
      custom_domain: data.custom_domain ?? null,
      plan: data.plan ?? 'free',
      is_active: true,
      limits: data.limits ?? null,
      trial_ends_at: DateTime.now().plus({ days: 14 }), // 14 day trial
    })

    // Assign owner to tenant
    await this.tenantUsersRepository.create({
      tenant_id: tenant.id,
      user_id: owner.id,
      role: TenantUserRole.OWNER,
      is_active: true,
      invited_at: DateTime.now(),
      joined_at: DateTime.now(),
    })

    return tenant
  }
}
