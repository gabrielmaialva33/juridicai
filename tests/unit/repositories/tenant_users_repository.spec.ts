import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import { TenantFactory } from '#database/factories/tenant_factory'
import { TenantUserFactory } from '#database/factories/tenant_user_factory'
import { UserFactory } from '#database/factories/user_factory'
import TenantUsersRepository from '#repositories/tenant_users_repository'
import { withTenantContext } from '#tests/utils/tenant_context_helper'

test.group('TenantUsersRepository', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('findByTenantAndUser returns tenant_user by composite key', async ({ assert }) => {
    await withTenantContext(async (tenant) => {
      const user = await UserFactory.create()
      const tenantUser = await TenantUserFactory.merge({
        tenant_id: tenant.id,
        user_id: user.id,
      }).create()

      const repository = await app.container.make(TenantUsersRepository)
      const result = await repository.findByTenantAndUser(tenant.id, user.id)

      assert.exists(result)
      assert.equal(result!.tenant_id, tenant.id)
      assert.equal(result!.user_id, user.id)
      assert.equal(result!.id, tenantUser.id)
    })
  })

  test('findByTenantAndUser returns null for non-existent relationship', async ({ assert }) => {
    const repository = await app.container.make(TenantUsersRepository)

    // Use a valid UUID that doesn't exist in the database
    const nonExistentTenantId = '00000000-0000-0000-0000-000000000000'
    const result = await repository.findByTenantAndUser(nonExistentTenantId, 999)

    assert.isNull(result)
  })

  test('findActiveByTenant returns only active users for tenant', async ({ assert }) => {
    await withTenantContext(async (tenant) => {
      const user1 = await UserFactory.create()
      const user2 = await UserFactory.create()
      const user3 = await UserFactory.create()

      await TenantUserFactory.merge({
        tenant_id: tenant.id,
        user_id: user1.id,
        is_active: true,
      }).create()
      await TenantUserFactory.merge({
        tenant_id: tenant.id,
        user_id: user2.id,
        is_active: true,
      }).create()
      await TenantUserFactory.merge({
        tenant_id: tenant.id,
        user_id: user3.id,
        is_active: false,
      }).create()

      const repository = await app.container.make(TenantUsersRepository)
      const result = await repository.findActiveByTenant(tenant.id)

      assert.lengthOf(result, 2)
      result.forEach((tu: any) => {
        assert.isTrue(tu.is_active)
        assert.equal(tu.tenant_id, tenant.id)
      })
    })
  })

  test('findActiveByUser returns only active tenants for user', async ({ assert }) => {
    await withTenantContext(async (_tenant) => {
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

      const repository = await app.container.make(TenantUsersRepository)
      const result = await repository.findActiveByUser(user.id)

      assert.lengthOf(result, 2)
      result.forEach((tu: any) => {
        assert.isTrue(tu.is_active)
        assert.equal(tu.user_id, user.id)
      })
    })
  })

  test('activateUser sets is_active to true', async ({ assert }) => {
    await withTenantContext(async (tenant) => {
      const user = await UserFactory.create()
      const tenantUser = await TenantUserFactory.merge({
        tenant_id: tenant.id,
        user_id: user.id,
        is_active: false,
      }).create()

      const repository = await app.container.make(TenantUsersRepository)
      const result = await repository.activateUser(tenant.id, user.id)

      assert.isTrue(result)

      await tenantUser.refresh()
      assert.isTrue(tenantUser.is_active)
    })
  })

  test('activateUser returns false for non-existent relationship', async ({ assert }) => {
    const repository = await app.container.make(TenantUsersRepository)

    const nonExistentTenantId = '00000000-0000-0000-0000-000000000000'
    const result = await repository.activateUser(nonExistentTenantId, 999)

    assert.isFalse(result)
  })

  test('deactivateUser sets is_active to false', async ({ assert }) => {
    await withTenantContext(async (tenant) => {
      const user = await UserFactory.create()
      const tenantUser = await TenantUserFactory.merge({
        tenant_id: tenant.id,
        user_id: user.id,
        is_active: true,
      }).create()

      const repository = await app.container.make(TenantUsersRepository)
      const result = await repository.deactivateUser(tenant.id, user.id)

      assert.isTrue(result)

      await tenantUser.refresh()
      assert.isFalse(tenantUser.is_active)
    })
  })

  test('deactivateUser returns false for non-existent relationship', async ({ assert }) => {
    const repository = await app.container.make(TenantUsersRepository)

    const nonExistentTenantId = '00000000-0000-0000-0000-000000000000'
    const result = await repository.deactivateUser(nonExistentTenantId, 999)

    assert.isFalse(result)
  })

  test('findActiveByTenant returns empty array when no active users', async ({ assert }) => {
    await withTenantContext(async (tenant) => {
      const repository = await app.container.make(TenantUsersRepository)

      const result = await repository.findActiveByTenant(tenant.id)

      assert.isEmpty(result)
    })
  })

  test('findActiveByUser returns empty array when no active tenants', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()
      const repository = await app.container.make(TenantUsersRepository)

      const result = await repository.findActiveByUser(user.id)

      assert.isEmpty(result)
    })
  })
})
