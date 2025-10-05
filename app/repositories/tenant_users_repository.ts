import TenantUser from '#models/tenant_user'
import ITenantUser from '#interfaces/tenant_user_interface'
import LucidRepository from '#shared/lucid/lucid_repository'

export default class TenantUsersRepository
  extends LucidRepository<typeof TenantUser>
  implements ITenantUser.Repository
{
  constructor() {
    super(TenantUser)
  }

  /**
   * Find a tenant user by tenant ID and user ID
   * @param tenantId - The tenant ID to search for
   * @param userId - The user ID to search for
   * @returns The tenant user if found, null otherwise
   */
  async findByTenantAndUser(tenantId: string, userId: number): Promise<TenantUser | null> {
    return this.model.query().where('tenant_id', tenantId).where('user_id', userId).first()
  }

  /**
   * Find all active users for a tenant
   * @param tenantId - The tenant ID to filter by
   * @returns Array of active tenant users
   */
  async findActiveByTenant(tenantId: string): Promise<TenantUser[]> {
    return this.model.query().where('tenant_id', tenantId).where('is_active', true).exec()
  }

  /**
   * Find all active tenants for a user
   * @param userId - The user ID to filter by
   * @returns Array of active tenant users
   */
  async findActiveByUser(userId: number): Promise<TenantUser[]> {
    return this.model.query().where('user_id', userId).where('is_active', true).exec()
  }

  /**
   * Activate a user in a tenant
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @returns True if the user was activated, false otherwise
   */
  async activateUser(tenantId: string, userId: number): Promise<boolean> {
    const tenantUser = await this.findByTenantAndUser(tenantId, userId)

    if (!tenantUser) {
      return false
    }

    tenantUser.is_active = true
    await tenantUser.save()

    return true
  }

  /**
   * Deactivate a user in a tenant
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @returns True if the user was deactivated, false otherwise
   */
  async deactivateUser(tenantId: string, userId: number): Promise<boolean> {
    const tenantUser = await this.findByTenantAndUser(tenantId, userId)

    if (!tenantUser) {
      return false
    }

    tenantUser.is_active = false
    await tenantUser.save()

    return true
  }
}
