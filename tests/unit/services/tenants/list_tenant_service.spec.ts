import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'

import ListTenantService from '#services/tenants/list_tenant_service'
import { TenantFactory } from '#database/factories/tenant_factory'

test.group('ListTenantsService', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('should return paginated list of tenants', async ({ assert }) => {
    // Create 5 tenants
    await TenantFactory.createMany(5)

    const service = await app.container.make(ListTenantService)
    const result = await service.run(undefined, undefined, undefined, 1, 10)

    assert.equal(result.all().length, 5)
    assert.equal(result.currentPage, 1)
    assert.equal(result.perPage, 10)
  })

  test('should filter by is_active', async ({ assert }) => {
    // Create 3 active and 2 inactive tenants
    await TenantFactory.createMany(3)
    await TenantFactory.apply('inactive').createMany(2)

    const service = await app.container.make(ListTenantService)

    // Filter for active tenants
    const activeResult = await service.run(true, undefined, undefined, 1, 20)
    assert.equal(activeResult.all().length, 3)
    activeResult.all().forEach((tenant) => {
      assert.isTrue(tenant.is_active)
    })

    // Filter for inactive tenants
    const inactiveResult = await service.run(false, undefined, undefined, 1, 20)
    assert.equal(inactiveResult.all().length, 2)
    inactiveResult.all().forEach((tenant) => {
      assert.isFalse(tenant.is_active)
    })
  })

  test('should filter by plan', async ({ assert }) => {
    // Create tenants with different plans
    await TenantFactory.apply('free').createMany(2)
    await TenantFactory.apply('pro').createMany(3)
    await TenantFactory.merge({ plan: 'enterprise' }).create()

    const service = await app.container.make(ListTenantService)

    // Filter for free plan
    const freeResult = await service.run(undefined, 'free', undefined, 1, 20)
    assert.equal(freeResult.all().length, 2)
    freeResult.all().forEach((tenant) => {
      assert.equal(tenant.plan, 'free')
    })

    // Filter for pro plan
    const proResult = await service.run(undefined, 'pro', undefined, 1, 20)
    assert.equal(proResult.all().length, 3)
    proResult.all().forEach((tenant) => {
      assert.equal(tenant.plan, 'pro')
    })

    // Filter for enterprise plan
    const enterpriseResult = await service.run(undefined, 'enterprise', undefined, 1, 20)
    assert.equal(enterpriseResult.all().length, 1)
    assert.equal(enterpriseResult.all()[0].plan, 'enterprise')
  })

  test('should search by name', async ({ assert }) => {
    await TenantFactory.merge({ name: 'Acme Corporation', subdomain: 'acme' }).create()
    await TenantFactory.merge({ name: 'Tech Startup', subdomain: 'tech' }).create()
    await TenantFactory.merge({ name: 'Law Firm', subdomain: 'law' }).create()

    const service = await app.container.make(ListTenantService)

    const result = await service.run(undefined, undefined, 'Acme', 1, 20)

    assert.equal(result.all().length, 1)
    assert.equal(result.all()[0].name, 'Acme Corporation')
  })

  test('should search by subdomain', async ({ assert }) => {
    await TenantFactory.merge({ name: 'Company A', subdomain: 'company-a' }).create()
    await TenantFactory.merge({ name: 'Company B', subdomain: 'company-b' }).create()
    await TenantFactory.merge({ name: 'Different', subdomain: 'different' }).create()

    const service = await app.container.make(ListTenantService)

    const result = await service.run(undefined, undefined, 'company', 1, 20)

    assert.equal(result.all().length, 2)
  })

  test('should combine multiple filters', async ({ assert }) => {
    // Create various tenants
    await TenantFactory.apply('free').merge({ name: 'Free Active', is_active: true }).create()
    await TenantFactory.apply('free').apply('inactive').merge({ name: 'Free Inactive' }).create()
    await TenantFactory.apply('pro').merge({ name: 'Pro Active', is_active: true }).create()

    const service = await app.container.make(ListTenantService)

    // Filter for active free plan tenants
    const result = await service.run(true, 'free', undefined, 1, 20)

    assert.equal(result.all().length, 1)
    assert.equal(result.all()[0].name, 'Free Active')
    assert.equal(result.all()[0].plan, 'free')
    assert.isTrue(result.all()[0].is_active)
  })

  test('should sort by created_at desc by default', async ({ assert }) => {
    // Create tenants with delays to ensure different timestamps
    const tenant1 = await TenantFactory.merge({ name: 'First' }).create()
    const tenant2 = await TenantFactory.merge({ name: 'Second' }).create()
    const tenant3 = await TenantFactory.merge({ name: 'Third' }).create()

    const service = await app.container.make(ListTenantService)
    const result = await service.run(undefined, undefined, undefined, 1, 20)

    const all = result.all()
    assert.equal(all.length, 3)
    // Most recent first
    assert.equal(all[0].name, 'Third')
    assert.equal(all[2].name, 'First')
  })

  test('should sort by name asc', async ({ assert }) => {
    await TenantFactory.merge({ name: 'Zebra Company', subdomain: 'zebra' }).create()
    await TenantFactory.merge({ name: 'Alpha Company', subdomain: 'alpha' }).create()
    await TenantFactory.merge({ name: 'Beta Company', subdomain: 'beta' }).create()

    const service = await app.container.make(ListTenantService)
    const result = await service.run(undefined, undefined, undefined, 1, 20, 'name', 'asc')

    const all = result.all()
    assert.equal(all[0].name, 'Alpha Company')
    assert.equal(all[1].name, 'Beta Company')
    assert.equal(all[2].name, 'Zebra Company')
  })

  test('should sort by subdomain desc', async ({ assert }) => {
    await TenantFactory.merge({ name: 'Company A', subdomain: 'aaa-subdomain' }).create()
    await TenantFactory.merge({ name: 'Company Z', subdomain: 'zzz-subdomain' }).create()
    await TenantFactory.merge({ name: 'Company M', subdomain: 'mmm-subdomain' }).create()

    const service = await app.container.make(ListTenantService)
    const result = await service.run(undefined, undefined, undefined, 1, 20, 'subdomain', 'desc')

    const all = result.all()
    assert.equal(all[0].subdomain, 'zzz-subdomain')
    assert.equal(all[1].subdomain, 'mmm-subdomain')
    assert.equal(all[2].subdomain, 'aaa-subdomain')
  })

  test('should paginate results correctly', async ({ assert }) => {
    // Create 25 tenants
    await TenantFactory.createMany(25)

    const service = await app.container.make(ListTenantService)

    // Get first page (10 items)
    const page1 = await service.run(undefined, undefined, undefined, 1, 10)
    assert.equal(page1.all().length, 10)
    assert.equal(page1.currentPage, 1)
    assert.equal(page1.total, 25)

    // Get second page (10 items)
    const page2 = await service.run(undefined, undefined, undefined, 2, 10)
    assert.equal(page2.all().length, 10)
    assert.equal(page2.currentPage, 2)

    // Get third page (5 items)
    const page3 = await service.run(undefined, undefined, undefined, 3, 10)
    assert.equal(page3.all().length, 5)
    assert.equal(page3.currentPage, 3)
  })

  test('should return empty result when no tenants match filters', async ({ assert }) => {
    await TenantFactory.apply('free').createMany(3)

    const service = await app.container.make(ListTenantService)

    // Search for non-existent plan
    const result = await service.run(undefined, 'pro', undefined, 1, 20)

    assert.equal(result.all().length, 0)
  })

  test('should search case-insensitively', async ({ assert }) => {
    await TenantFactory.merge({ name: 'UPPERCASE Company', subdomain: 'uppercase' }).create()
    await TenantFactory.merge({ name: 'lowercase company', subdomain: 'lowercase' }).create()

    const service = await app.container.make(ListTenantService)

    // Search with lowercase
    const result = await service.run(undefined, undefined, 'company', 1, 20)

    assert.equal(result.all().length, 2)
  })
})
