import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'

import CreateTenantService from '#services/tenants/create_tenant_service'
import { TenantFactory } from '#database/factories/tenant_factory'
import { UserFactory } from '#database/factories/user_factory'
import { withTenantContext } from '#tests/utils/tenant_context_helper'

test.group('CreateTenantService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should create tenant with valid data', async ({ assert }) => {
    await withTenantContext(async () => {
      const owner = await UserFactory.create()
      const service = await app.container.make(CreateTenantService)

      const tenantData = {
        name: 'Test Company',
        subdomain: 'test-company',
        owner_user_id: owner.id,
      }

      const result = await service.run(tenantData)

      assert.exists(result)
      assert.equal(result.name, tenantData.name)
      assert.equal(result.subdomain, tenantData.subdomain)
      assert.equal(result.plan, 'free')
      assert.isTrue(result.is_active)
      assert.exists(result.trial_ends_at)
    })
  })

  test('should create tenant_user relationship with owner role', async ({ assert }) => {
    await withTenantContext(async () => {
      const owner = await UserFactory.create()
      const service = await app.container.make(CreateTenantService)

      const tenantData = {
        name: 'Test Company',
        subdomain: 'test-company-owner',
        owner_user_id: owner.id,
      }

      const tenant = await service.run(tenantData)

      // Load the tenant users relationship
      await tenant.load('tenant_users')

      assert.lengthOf(tenant.tenant_users, 1)
      assert.equal(tenant.tenant_users[0].user_id, owner.id)
      assert.equal(tenant.tenant_users[0].role, 'owner')
      assert.isTrue(tenant.tenant_users[0].is_active)
      assert.exists(tenant.tenant_users[0].joined_at)
      assert.exists(tenant.tenant_users[0].invited_at)
    })
  })

  test('should validate unique subdomain and throw error', async ({ assert }) => {
    await withTenantContext(async () => {
      const owner = await UserFactory.create()
      const existingTenant = await TenantFactory.merge({ subdomain: 'existing-subdomain' }).create()

      const service = await app.container.make(CreateTenantService)

      await assert.rejects(async () => {
        await service.run({
          name: 'New Company',
          subdomain: existingTenant.subdomain,
          owner_user_id: owner.id,
        })
      }, `Subdomain '${existingTenant.subdomain}' is already taken`)
    })
  })

  test('should validate unique custom_domain and throw error', async ({ assert }) => {
    await withTenantContext(async () => {
      const owner = await UserFactory.create()
      const existingTenant = await TenantFactory.merge({ custom_domain: 'existing.com' }).create()

      const service = await app.container.make(CreateTenantService)

      await assert.rejects(async () => {
        await service.run({
          name: 'New Company',
          subdomain: 'new-company',
          custom_domain: existingTenant.custom_domain!,
          owner_user_id: owner.id,
        })
      }, `Custom domain '${existingTenant.custom_domain}' is already in use`)
    })
  })

  test('should throw error if user does not exist', async ({ assert }) => {
    await withTenantContext(async () => {
      const service = await app.container.make(CreateTenantService)

      await assert.rejects(async () => {
        await service.run({
          name: 'Test Company',
          subdomain: 'test-company',
          owner_user_id: 99999,
        })
      }, 'Owner user not found')
    })
  })

  test('should create tenant with custom plan', async ({ assert }) => {
    await withTenantContext(async () => {
      const owner = await UserFactory.create()
      const service = await app.container.make(CreateTenantService)

      const tenantData = {
        name: 'Pro Company',
        subdomain: 'pro-company',
        plan: 'pro' as const,
        owner_user_id: owner.id,
      }

      const result = await service.run(tenantData)

      assert.equal(result.plan, 'pro')
    })
  })

  test('should create tenant with custom limits', async ({ assert }) => {
    await withTenantContext(async () => {
      const owner = await UserFactory.create()
      const service = await app.container.make(CreateTenantService)

      const limits = {
        max_users: 50,
        max_cases: 1000,
        max_storage_gb: 100,
        max_documents: 5000,
      }

      const tenantData = {
        name: 'Custom Limits Company',
        subdomain: 'custom-limits',
        limits,
        owner_user_id: owner.id,
      }

      const result = await service.run(tenantData)

      assert.deepEqual(result.limits, limits)
    })
  })

  test('should create tenant with null custom_domain by default', async ({ assert }) => {
    await withTenantContext(async () => {
      const owner = await UserFactory.create()
      const service = await app.container.make(CreateTenantService)

      const tenantData = {
        name: 'Test Company',
        subdomain: 'test-no-custom-domain',
        owner_user_id: owner.id,
      }

      const result = await service.run(tenantData)

      assert.isNull(result.custom_domain)
    })
  })

  test('should create tenant with custom_domain when provided', async ({ assert }) => {
    await withTenantContext(async () => {
      const owner = await UserFactory.create()
      const service = await app.container.make(CreateTenantService)

      const tenantData = {
        name: 'Custom Domain Company',
        subdomain: 'custom-domain-test',
        custom_domain: 'mycompany.com',
        owner_user_id: owner.id,
      }

      const result = await service.run(tenantData)

      assert.equal(result.custom_domain, 'mycompany.com')
    })
  })
})
