import LucidRepositoryInterface from '#shared/lucid/lucid_repository_interface'
import TenantUser from '#models/tenant_user'

namespace ITenantUser {
  export interface Repository extends LucidRepositoryInterface<typeof TenantUser> {
    /**
     * Find a tenant user by tenant ID and user ID
     * @param tenantId - The tenant ID
     * @param userId - The user ID
     */
    findByTenantAndUser(tenantId: string, userId: number): Promise<TenantUser | null>

    /**
     * Find all active users for a tenant
     * @param tenantId - The tenant ID
     */
    findActiveByTenant(tenantId: string): Promise<TenantUser[]>

    /**
     * Find all active tenants for a user
     * @param userId - The user ID
     */
    findActiveByUser(userId: number): Promise<TenantUser[]>

    /**
     * Activate a user in a tenant
     * @param tenantId - The tenant ID
     * @param userId - The user ID
     */
    activateUser(tenantId: string, userId: number): Promise<boolean>

    /**
     * Deactivate a user in a tenant
     * @param tenantId - The tenant ID
     * @param userId - The user ID
     */
    deactivateUser(tenantId: string, userId: number): Promise<boolean>
  }

  export interface CreatePayload {
    id?: number
    tenant_id: string
    user_id: number
    role: 'owner' | 'admin' | 'lawyer' | 'assistant'
    custom_permissions?: Record<string, any> | null
    is_active?: boolean
    invited_at?: string | null
    joined_at?: string | null
  }

  export interface EditPayload {
    role?: 'owner' | 'admin' | 'lawyer' | 'assistant'
    custom_permissions?: Record<string, any> | null
    is_active?: boolean
    invited_at?: string | null
    joined_at?: string | null
  }

  export interface FilterPayload {
    tenant_id?: string
    user_id?: number
    role?: 'owner' | 'admin' | 'lawyer' | 'assistant'
    is_active?: boolean
  }
}

export default ITenantUser
