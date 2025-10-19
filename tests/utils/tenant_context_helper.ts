import { TenantFactory } from '#database/factories/tenant_factory'
import Tenant from '#models/tenant'
import TenantContextService from '#services/tenants/tenant_context_service'

/**
 * Establish tenant context for a test.
 * Use this in tests that create tenant-scoped models.
 *
 * @param callback - The test function to run within tenant context
 * @param tenant - Optional existing tenant to use (creates new tenant if not provided)
 * @returns The result of the callback
 *
 * @example
 * ```ts
 * test('creates a client', async ({ assert }) => {
 *   await withTenantContext(async (tenant) => {
 *     const client = await ClientFactory.create()
 *     assert.equal(client.tenant_id, tenant.id)
 *   })
 * })
 * ```
 */
export async function withTenantContext<T>(
  callback: (tenant: Tenant) => Promise<T>,
  tenant?: Tenant
): Promise<T> {
  const testTenant = tenant || (await TenantFactory.create())

  return await TenantContextService.run(
    {
      tenant_id: testTenant.id,
      tenant: testTenant,
      user_id: null,
      tenant_user: null,
    },
    async () => {
      return await callback(testTenant)
    }
  )
}

/**
 * Setup tenant context for all tests in a group.
 * Call this in group.each.setup() to automatically establish context for each test.
 *
 * @returns A cleanup function (currently a no-op as context is per-test)
 *
 * @example
 * ```ts
 * test.group('MyTests', (group) => {
 *   let tenant: Tenant
 *
 *   group.each.setup(async () => {
 *     tenant = await setupTenantContext()
 *     return testUtils.db().withGlobalTransaction()
 *   })
 *
 *   test('creates a client', async ({ assert }) => {
 *     const client = await ClientFactory.create()
 *     assert.equal(client.tenant_id, tenant.id)
 *   })
 * })
 * ```
 */
export async function setupTenantContext(): Promise<Tenant> {
  const tenant = await TenantFactory.create()

  // Establish tenant context for the current async scope
  await TenantContextService.run(
    {
      tenant_id: tenant.id,
      tenant: tenant,
      user_id: null,
      tenant_user: null,
    },
    async () => {
      // This establishes the context for the test
    }
  )

  return tenant
}
