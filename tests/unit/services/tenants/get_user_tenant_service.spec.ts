import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'

import GetUserTenantsService from '#services/tenants/get_user_tenant_service'
import { TenantFactory } from '#database/factories/tenant_factory'
import { UserFactory } from '#database/factories/user_factory'
import { TenantUserFactory } from '#database/factories/tenant_user_factory'

test.group('GetUserTenantsService', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('should return active tenants for user', async ({ assert }) => {
    const user = await UserFactory.create()

    // Create 2 active tenants with the user
    const tenant1 = await TenantFactory.merge({ name: 'Tenant 1', is_active: true }).create()
    const tenant2 = await TenantFactory.merge({ name: 'Tenant 2', is_active: true }).create()

    await TenantUserFactory.merge({ tenant_id: tenant1.id, user_id: user.id, is_active: true })
      .apply('owner')
      .create()
    await TenantUserFactory.merge({ tenant_id: tenant2.id, user_id: user.id, is_active: true })
      .apply('lawyer')
      .create()

    const service = await app.container.make(GetUserTenantsService)
    const result = await service.run(user.id)

    assert.equal(result.length, 2)
    assert.includeMembers(
      result.map((t) => t.id),
      [tenant1.id, tenant2.id]
    )
  })

  test('should return empty array if user has no tenants', async ({ assert }) => {
    const user = await UserFactory.create()

    const service = await app.container.make(GetUserTenantsService)
    const result = await service.run(user.id)

    assert.equal(result.length, 0)
    assert.isArray(result)
  })

  test('should only return active tenants (is_active=true)', async ({ assert }) => {
    const user = await UserFactory.create()

    // Create 1 active and 1 inactive tenant
    const activeTenant = await TenantFactory.merge({
      name: 'Active Tenant',
      is_active: true,
    }).create()
    const inactiveTenant = await TenantFactory.apply('inactive')
      .merge({
        name: 'Inactive Tenant',
      })
      .create()

    await TenantUserFactory.merge({
      tenant_id: activeTenant.id,
      user_id: user.id,
      is_active: true,
    })
      .apply('owner')
      .create()

    await TenantUserFactory.merge({
      tenant_id: inactiveTenant.id,
      user_id: user.id,
      is_active: true,
    })
      .apply('owner')
      .create()

    const service = await app.container.make(GetUserTenantsService)
    const result = await service.run(user.id)

    assert.equal(result.length, 1)
    assert.equal(result[0].id, activeTenant.id)
    assert.isTrue(result[0].is_active)
  })

  test('should only return tenants where user is active member', async ({ assert }) => {
    const user = await UserFactory.create()

    // Create 2 tenants
    const tenant1 = await TenantFactory.merge({
      name: 'Active Membership',
      is_active: true,
    }).create()
    const tenant2 = await TenantFactory.merge({
      name: 'Inactive Membership',
      is_active: true,
    }).create()

    // User is active member in tenant1
    await TenantUserFactory.merge({
      tenant_id: tenant1.id,
      user_id: user.id,
      is_active: true,
    })
      .apply('owner')
      .create()

    // User is inactive member in tenant2
    await TenantUserFactory.merge({
      tenant_id: tenant2.id,
      user_id: user.id,
      is_active: false,
    })
      .apply('owner')
      .create()

    const service = await app.container.make(GetUserTenantsService)
    const result = await service.run(user.id)

    assert.equal(result.length, 1)
    assert.equal(result[0].id, tenant1.id)
  })

  test('should order by created_at desc (newest first)', async ({ assert }) => {
    const user = await UserFactory.create()

    // Create 3 tenants at different times
    const oldTenant = await TenantFactory.merge({
      name: 'Old Tenant',
      is_active: true,
      created_at: DateTime.now().minus({ hours: 2 }),
    }).create()
    const middleTenant = await TenantFactory.merge({
      name: 'Middle Tenant',
      is_active: true,
      created_at: DateTime.now().minus({ hours: 1 }),
    }).create()
    const newTenant = await TenantFactory.merge({
      name: 'New Tenant',
      is_active: true,
      created_at: DateTime.now(),
    }).create()

    await TenantUserFactory.merge({ tenant_id: oldTenant.id, user_id: user.id, is_active: true })
      .apply('owner')
      .create()
    await TenantUserFactory.merge({
      tenant_id: middleTenant.id,
      user_id: user.id,
      is_active: true,
    })
      .apply('owner')
      .create()
    await TenantUserFactory.merge({ tenant_id: newTenant.id, user_id: user.id, is_active: true })
      .apply('owner')
      .create()

    const service = await app.container.make(GetUserTenantsService)
    const result = await service.run(user.id)

    assert.equal(result.length, 3)
    // Newest should be first
    assert.equal(result[0].name, 'New Tenant')
    assert.equal(result[2].name, 'Old Tenant')
  })

  test('should not return tenants from other users', async ({ assert }) => {
    const user1 = await UserFactory.create()
    const user2 = await UserFactory.create()

    const tenant1 = await TenantFactory.merge({ name: 'User 1 Tenant', is_active: true }).create()
    const tenant2 = await TenantFactory.merge({ name: 'User 2 Tenant', is_active: true }).create()

    await TenantUserFactory.merge({ tenant_id: tenant1.id, user_id: user1.id, is_active: true })
      .apply('owner')
      .create()
    await TenantUserFactory.merge({ tenant_id: tenant2.id, user_id: user2.id, is_active: true })
      .apply('owner')
      .create()

    const service = await app.container.make(GetUserTenantsService)
    const result = await service.run(user1.id)

    assert.equal(result.length, 1)
    assert.equal(result[0].id, tenant1.id)
  })

  test('should handle user with multiple roles across tenants', async ({ assert }) => {
    const user = await UserFactory.create()

    const tenant1 = await TenantFactory.merge({ name: 'Owner Tenant', is_active: true }).create()
    const tenant2 = await TenantFactory.merge({ name: 'Lawyer Tenant', is_active: true }).create()
    const tenant3 = await TenantFactory.merge({
      name: 'Assistant Tenant',
      is_active: true,
    }).create()

    await TenantUserFactory.merge({ tenant_id: tenant1.id, user_id: user.id, is_active: true })
      .apply('owner')
      .create()
    await TenantUserFactory.merge({ tenant_id: tenant2.id, user_id: user.id, is_active: true })
      .apply('lawyer')
      .create()
    await TenantUserFactory.merge({ tenant_id: tenant3.id, user_id: user.id, is_active: true })
      .apply('assistant')
      .create()

    const service = await app.container.make(GetUserTenantsService)
    const result = await service.run(user.id)

    assert.equal(result.length, 3)
  })

  test('should return empty array for non-existent user', async ({ assert }) => {
    const service = await app.container.make(GetUserTenantsService)
    const result = await service.run(99999)

    assert.equal(result.length, 0)
    assert.isArray(result)
  })

  test('should combine both tenant and tenant_user active filters', async ({ assert }) => {
    const user = await UserFactory.create()

    // Scenario 1: Active tenant, active user
    const tenant1 = await TenantFactory.merge({ name: 'Both Active', is_active: true }).create()
    await TenantUserFactory.merge({ tenant_id: tenant1.id, user_id: user.id, is_active: true })
      .apply('owner')
      .create()

    // Scenario 2: Active tenant, inactive user
    const tenant2 = await TenantFactory.merge({
      name: 'Tenant Active, User Inactive',
      is_active: true,
    }).create()
    await TenantUserFactory.merge({ tenant_id: tenant2.id, user_id: user.id, is_active: false })
      .apply('owner')
      .create()

    // Scenario 3: Inactive tenant, active user
    const tenant3 = await TenantFactory.apply('inactive')
      .merge({
        name: 'Tenant Inactive, User Active',
      })
      .create()
    await TenantUserFactory.merge({ tenant_id: tenant3.id, user_id: user.id, is_active: true })
      .apply('owner')
      .create()

    // Scenario 4: Inactive tenant, inactive user
    const tenant4 = await TenantFactory.apply('inactive').merge({ name: 'Both Inactive' }).create()
    await TenantUserFactory.merge({ tenant_id: tenant4.id, user_id: user.id, is_active: false })
      .apply('owner')
      .create()

    const service = await app.container.make(GetUserTenantsService)
    const result = await service.run(user.id)

    // Only scenario 1 should be returned
    assert.equal(result.length, 1)
    assert.equal(result[0].id, tenant1.id)
  })
})
