import { TenantFactory } from '#database/factories/tenant_factory'
import { TenantUserFactory } from '#database/factories/tenant_user_factory'
import Tenant from '#models/tenant'
import User from '#models/user'

/**
 * Setup a tenant and associate a user with it.
 * This is essential for functional tests that use authenticated requests,
 * as the tenant_resolver_middleware requires users to belong to a tenant.
 *
 * @param user - The user to associate with the tenant
 * @param role - The role the user should have in the tenant (default: 'owner')
 * @param existingTenant - Optional existing tenant to add user to (creates new tenant if not provided)
 * @returns The tenant (either created or provided)
 */
export async function setupTenantForUser(
  user: User,
  role: 'owner' | 'admin' | 'lawyer' | 'assistant' = 'owner',
  existingTenant?: Tenant
): Promise<Tenant> {
  const tenant = existingTenant || (await TenantFactory.create())

  await TenantUserFactory.merge({
    tenant_id: tenant.id,
    user_id: user.id,
    role: role,
  }).create()

  return tenant
}
