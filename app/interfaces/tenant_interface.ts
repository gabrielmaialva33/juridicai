import LucidRepositoryInterface from '#shared/lucid/lucid_repository_interface'
import Tenant from '#models/tenant'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

namespace ITenant {
  export interface Repository extends LucidRepositoryInterface<typeof Tenant> {
    /**
     * Find a tenant by subdomain
     * @param subdomain
     */
    findBySubdomain(subdomain: string): Promise<Tenant | null>

    /**
     * Find a tenant by custom domain
     * @param customDomain
     */
    findByCustomDomain(customDomain: string): Promise<Tenant | null>

    /**
     * Find all active tenants by plan
     * @param plan
     */
    findActiveByPlan(plan: string): Promise<Tenant[]>

    /**
     * Search tenants with pagination
     * @param search - Search term to match against tenant name or subdomain
     * @param page - Page number
     * @param limit - Results per page
     */
    searchTenants(
      search: string,
      page: number,
      limit: number
    ): Promise<ModelPaginatorContract<Tenant>>
  }

  export interface CreatePayload {
    id?: string
    name: string
    subdomain: string
    custom_domain?: string | null
    plan: 'free' | 'starter' | 'pro' | 'enterprise'
    is_active?: boolean
    limits?: {
      max_users?: number
      max_cases?: number
      max_storage_gb?: number
      max_documents?: number
      [key: string]: any
    } | null
    trial_ends_at?: string | null
    suspended_at?: string | null
    suspended_reason?: string | null
  }

  export interface EditPayload {
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
      [key: string]: any
    } | null
    trial_ends_at?: string | null
    suspended_at?: string | null
    suspended_reason?: string | null
  }

  export interface FilterPayload {
    plan?: 'free' | 'starter' | 'pro' | 'enterprise'
    is_active?: boolean
    subdomain?: string
    custom_domain?: string
  }
}

export default ITenant
