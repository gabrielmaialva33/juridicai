import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import { TenantFactory } from '#database/factories/tenant_factory'
import { TenantUserFactory } from '#database/factories/tenant_user_factory'
import { UserFactory } from '#database/factories/user_factory'
import TenantsRepository from '#repositories/tenants_repository'

test.group('TenantsRepository', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('findBySubdomain returns tenant by subdomain', async ({ assert }) => {
    const tenant = await TenantFactory.merge({ subdomain: 'test-firm' }).create()
    const repository = await app.container.make(TenantsRepository)

    const result = await repository.findBySubdomain('test-firm')

    assert.exists(result)
    assert.equal(result!.id, tenant.id)
    assert.equal(result!.subdomain, 'test-firm')
  })

  test('findBySubdomain returns null for non-existent subdomain', async ({ assert }) => {
    const repository = await app.container.make(TenantsRepository)

    const result = await repository.findBySubdomain('non-existent')

    assert.isNull(result)
  })

  test('findByCustomDomain returns tenant by custom_domain', async ({ assert }) => {
    const tenant = await TenantFactory.merge({ custom_domain: 'example.com' }).create()
    const repository = await app.container.make(TenantsRepository)

    const result = await repository.findByCustomDomain('example.com')

    assert.exists(result)
    assert.equal(result!.id, tenant.id)
    assert.equal(result!.custom_domain, 'example.com')
  })

  test('findByCustomDomain returns null when custom_domain is not set', async ({ assert }) => {
    const repository = await app.container.make(TenantsRepository)

    const result = await repository.findByCustomDomain('nonexistent.com')

    assert.isNull(result)
  })

  test('findActiveByPlan returns only active tenants with specified plan', async ({ assert }) => {
    await TenantFactory.apply('pro').create()
    await TenantFactory.apply('free').create()
    await TenantFactory.apply('pro').apply('inactive').create()

    const repository = await app.container.make(TenantsRepository)
    const result = await repository.findActiveByPlan('pro')

    assert.lengthOf(result, 1)
    assert.equal(result[0].plan, 'pro')
    assert.isTrue(result[0].is_active)
  })

  test('searchTenants paginates results', async ({ assert }) => {
    await TenantFactory.createMany(15)
    const repository = await app.container.make(TenantsRepository)

    const result = await repository.searchTenants('', 1, 10)

    assert.equal(result.perPage, 10)
    assert.equal(result.currentPage, 1)
    assert.lengthOf(result.all(), 10)
  })

  test('searchTenants filters by search term', async ({ assert }) => {
    await TenantFactory.merge({ name: 'Acme Law Firm', subdomain: 'acme' }).create()
    await TenantFactory.merge({ name: 'Beta Legal', subdomain: 'beta' }).create()

    const repository = await app.container.make(TenantsRepository)
    const result = await repository.searchTenants('acme', 1, 10)

    assert.lengthOf(result.all(), 1)
    assert.equal(result.all()[0].name, 'Acme Law Firm')
  })

  test('listWithFilters filters by is_active', async ({ assert }) => {
    await TenantFactory.createMany(3)
    await TenantFactory.apply('inactive').createMany(2)

    const repository = await app.container.make(TenantsRepository)
    const result = await repository.listWithFilters({ isActive: true }, 1, 10)

    assert.lengthOf(result.all(), 3)
    result.all().forEach((tenant) => assert.isTrue(tenant.is_active))
  })

  test('listWithFilters filters by plan', async ({ assert }) => {
    await TenantFactory.apply('pro').createMany(2)
    await TenantFactory.apply('free').createMany(3)

    const repository = await app.container.make(TenantsRepository)
    const result = await repository.listWithFilters({ plan: 'pro' }, 1, 10)

    assert.lengthOf(result.all(), 2)
    result.all().forEach((tenant) => assert.equal(tenant.plan, 'pro'))
  })

  test('listWithFilters searches by name/subdomain', async ({ assert }) => {
    await TenantFactory.merge({ name: 'Test Law Firm' }).create()
    await TenantFactory.merge({ subdomain: 'test-sub' }).create()
    await TenantFactory.merge({ name: 'Other Firm' }).create()

    const repository = await app.container.make(TenantsRepository)
    const result = await repository.listWithFilters({ search: 'test' }, 1, 10)

    assert.isAtLeast(result.all().length, 2)
  })

  test('findByUserId returns tenants for user', async ({ assert }) => {
    const user = await UserFactory.create()
    const tenant1 = await TenantFactory.create()
    const tenant2 = await TenantFactory.create()
    const tenant3 = await TenantFactory.create()

    await TenantUserFactory.merge({
      tenant_id: tenant1.id,
      user_id: user.id,
      is_active: true,
    }).create()
    await TenantUserFactory.merge({
      tenant_id: tenant2.id,
      user_id: user.id,
      is_active: true,
    }).create()
    await TenantUserFactory.merge({
      tenant_id: tenant3.id,
      user_id: user.id,
      is_active: false,
    }).create()

    const repository = await app.container.make(TenantsRepository)
    const result = await repository.findByUserId(user.id)

    assert.lengthOf(result, 2)
    assert.includeMembers(
      result.map((t) => t.id),
      [tenant1.id, tenant2.id]
    )
  })
})
