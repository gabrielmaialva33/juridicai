import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'

import UpdateTenantService from '#services/tenants/update_tenant_service'
import { TenantFactory } from '#database/factories/tenant_factory'

test.group('UpdateTenantService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should update tenant with valid data', async ({ assert }) => {
    const tenant = await TenantFactory.merge({
      name: 'Original Name',
      subdomain: 'original-subdomain',
    }).create()

    const service = await app.container.make(UpdateTenantService)

    const updateData = {
      name: 'Updated Name',
      plan: 'pro' as const,
    }

    const result = await service.run(tenant.id, updateData)

    assert.equal(result.name, 'Updated Name')
    assert.equal(result.plan, 'pro')
    assert.equal(result.subdomain, 'original-subdomain') // unchanged
  })

  test('should validate unique subdomain on update', async ({ assert }) => {
    const tenant1 = await TenantFactory.merge({ subdomain: 'tenant-one' }).create()
    const tenant2 = await TenantFactory.merge({ subdomain: 'tenant-two' }).create()

    const service = await app.container.make(UpdateTenantService)

    await assert.rejects(async () => {
      await service.run(tenant1.id, {
        subdomain: tenant2.subdomain,
      })
    }, `Subdomain '${tenant2.subdomain}' is already taken`)
  })

  test('should validate unique custom_domain on update', async ({ assert }) => {
    const tenant1 = await TenantFactory.merge({ custom_domain: 'tenant1.com' }).create()
    const tenant2 = await TenantFactory.merge({ custom_domain: 'tenant2.com' }).create()

    const service = await app.container.make(UpdateTenantService)

    await assert.rejects(async () => {
      await service.run(tenant1.id, {
        custom_domain: tenant2.custom_domain!,
      })
    }, `Custom domain '${tenant2.custom_domain}' is already in use`)
  })

  test('should throw error if tenant does not exist', async ({ assert }) => {
    const service = await app.container.make(UpdateTenantService)

    // Use a valid UUID that doesn't exist
    const nonExistentId = '00000000-0000-0000-0000-000000000000'

    await assert.rejects(async () => {
      await service.run(nonExistentId, {
        name: 'Updated Name',
      })
    }, 'Tenant not found')
  })

  test('should update only provided fields (partial update)', async ({ assert }) => {
    const tenant = await TenantFactory.merge({
      name: 'Original Name',
      subdomain: 'original-subdomain',
      plan: 'free',
      custom_domain: 'original.com',
    }).create()

    const service = await app.container.make(UpdateTenantService)

    const result = await service.run(tenant.id, {
      name: 'New Name Only',
    })

    assert.equal(result.name, 'New Name Only')
    assert.equal(result.subdomain, tenant.subdomain)
    assert.equal(result.plan, tenant.plan)
    assert.equal(result.custom_domain, tenant.custom_domain)
  })

  test('should allow updating to same subdomain', async ({ assert }) => {
    const tenant = await TenantFactory.merge({ subdomain: 'my-subdomain' }).create()

    const service = await app.container.make(UpdateTenantService)

    const result = await service.run(tenant.id, {
      subdomain: 'my-subdomain',
      name: 'Updated Name',
    })

    assert.equal(result.subdomain, 'my-subdomain')
    assert.equal(result.name, 'Updated Name')
  })

  test('should allow updating to same custom_domain', async ({ assert }) => {
    const tenant = await TenantFactory.merge({ custom_domain: 'my-domain.com' }).create()

    const service = await app.container.make(UpdateTenantService)

    const result = await service.run(tenant.id, {
      custom_domain: 'my-domain.com',
      name: 'Updated Name',
    })

    assert.equal(result.custom_domain, 'my-domain.com')
    assert.equal(result.name, 'Updated Name')
  })

  test('should update limits', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const service = await app.container.make(UpdateTenantService)

    const newLimits = {
      max_users: 100,
      max_cases: 5000,
      max_storage_gb: 500,
      max_documents: 10000,
    }

    const result = await service.run(tenant.id, {
      limits: newLimits,
    })

    assert.deepEqual(result.limits, newLimits)
  })

  test('should deactivate tenant and set suspended_at', async ({ assert }) => {
    const tenant = await TenantFactory.merge({ is_active: true }).create()

    const service = await app.container.make(UpdateTenantService)

    const result = await service.run(tenant.id, {
      is_active: false,
      suspended_reason: 'Payment failed',
    })

    assert.isFalse(result.is_active)
    assert.exists(result.suspended_at)
    assert.equal(result.suspended_reason, 'Payment failed')
  })

  test('should activate tenant and clear suspended fields', async ({ assert }) => {
    const tenant = await TenantFactory.apply('inactive')
      .merge({
        suspended_reason: 'Test suspension',
      })
      .create()

    const service = await app.container.make(UpdateTenantService)

    const result = await service.run(tenant.id, {
      is_active: true,
    })

    assert.isTrue(result.is_active)
    assert.isNull(result.suspended_at)
    assert.isNull(result.suspended_reason)
  })

  test('should update plan', async ({ assert }) => {
    const tenant = await TenantFactory.apply('free').create()

    const service = await app.container.make(UpdateTenantService)

    const result = await service.run(tenant.id, {
      plan: 'enterprise',
    })

    assert.equal(result.plan, 'enterprise')
  })
})
