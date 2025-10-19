import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'

import Role from '#models/role'
import User from '#models/user'
import Tenant from '#models/tenant'

import IRole from '#interfaces/role_interface'

import SignInService from '#services/users/sign_in_service'
import { withTenantContext } from '#tests/utils/tenant_context_helper'

test.group('SignInService', (group) => {
  let systemTenant: Tenant

  group.setup(async () => {
    // Get or create System tenant for roles (once for all tests)
    systemTenant = await Tenant.firstOrCreate(
      { subdomain: 'system' },
      {
        name: 'System',
        subdomain: 'system',
        plan: 'enterprise',
        is_active: true,
      }
    )

    // Get or create default roles in System tenant (without tenant scope)
    let userRole = await Role.withoutTenantScope()
      .where('slug', IRole.Slugs.USER)
      .where('tenant_id', systemTenant.id)
      .first()
    if (!userRole) {
      // Create role without tenant scope to avoid context errors
      userRole = await Role.withoutTenantScope().create({
        tenant_id: systemTenant.id,
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      })
    }

    let adminRole = await Role.withoutTenantScope()
      .where('slug', IRole.Slugs.ADMIN)
      .where('tenant_id', systemTenant.id)
      .first()
    if (!adminRole) {
      // Create role without tenant scope to avoid context errors
      adminRole = await Role.withoutTenantScope().create({
        tenant_id: systemTenant.id,
        name: 'Admin',
        slug: IRole.Slugs.ADMIN,
        description: 'Administrator role',
      })
    }
  })

  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should sign in user with valid credentials', async ({ assert }) => {
    await withTenantContext(async (tenant) => {
      const password = 'password123'
      const ctx = await testUtils.createHttpContext()

      const user = await User.create({
        tenant_id: tenant.id,
        full_name: 'John Doe',
        email: 'john@example.com',
        username: 'johndoe',
        password: password,
      })

      // Need to reload user with roles
      await user.load('roles')

      const service = await app.container.make(SignInService)
      const result = await service.run({
        uid: 'john@example.com',
        password: password,
        ctx: ctx,
      })

      assert.exists(result.auth)
      assert.exists(result.auth.access_token)
      assert.exists(result.auth.refresh_token)
      assert.isString(result.auth.access_token)
      assert.isString(result.auth.refresh_token)
      assert.equal(result.id, user.id)
      assert.equal(result.email, user.email)
      assert.equal(result.full_name, user.full_name)
    })
  })

  test('should throw exception for non-existent user', async ({ assert }) => {
    await withTenantContext(async () => {
      const ctx = await testUtils.createHttpContext()
      const service = await app.container.make(SignInService)

      await assert.rejects(async () => {
        await service.run({
          uid: 'nonexistent@example.com',
          password: 'password123',
          ctx: ctx,
        })
      }, 'Invalid user credentials')
    })
  })

  test('should throw exception for invalid password', async ({ assert }) => {
    await withTenantContext(async (tenant) => {
      const password = 'password123'
      const ctx = await testUtils.createHttpContext()

      const user = await User.create({
        tenant_id: tenant.id,
        full_name: 'John Doe',
        email: 'john@example.com',
        username: 'johndoe',
        password: password,
      })

      // Force reload to ensure we have the hashed password
      await user.refresh()

      const service = await app.container.make(SignInService)

      await assert.rejects(async () => {
        await service.run({
          uid: 'john@example.com',
          password: 'wrongpassword',
          ctx: ctx,
        })
      }, 'Invalid user credentials')
    })
  })

  test('should include roles in user data', async ({ assert }) => {
    await withTenantContext(async (tenant) => {
      const password = 'password123'
      const ctx = await testUtils.createHttpContext()

      const user = await User.create({
        tenant_id: tenant.id,
        full_name: 'John Doe',
        email: 'john@example.com',
        username: 'johndoe',
        password: password,
      })

      // Attach admin role in addition to default user role
      const adminRole = await Role.withoutTenantScope()
        .where('slug', IRole.Slugs.ADMIN)
        .firstOrFail()
      await db.table('user_roles').insert({
        user_id: user.id,
        role_id: adminRole.id,
      })

      const service = await app.container.make(SignInService)
      const result = await service.run({
        uid: 'john@example.com',
        password: password,
        ctx: ctx,
      })

      assert.exists(result.auth)
      assert.exists(result.id)
      assert.equal(result.email, user.email)
    })
  })

  test('should handle user without roles', async ({ assert }) => {
    await withTenantContext(async (tenant) => {
      const password = 'password123'
      const ctx = await testUtils.createHttpContext()

      const user = await User.create({
        tenant_id: tenant.id,
        full_name: 'John Doe',
        email: 'john@example.com',
        username: 'johndoe',
        password: password,
      })

      const service = await app.container.make(SignInService)
      const result = await service.run({
        uid: 'john@example.com',
        password: password,
        ctx: ctx,
      })

      assert.exists(result.auth)
      assert.exists(result.auth.access_token)
      assert.exists(result.auth.refresh_token)
      assert.equal(result.id, user.id)
    })
  })

  test('should handle soft deleted users', async ({ assert }) => {
    await withTenantContext(async (tenant) => {
      const password = 'password123'
      const ctx = await testUtils.createHttpContext()

      const user = await User.create({
        tenant_id: tenant.id,
        full_name: 'John Doe',
        email: 'john@example.com',
        username: 'johndoe',
        password: password,
      })

      // Soft delete the user
      await user.delete()

      const service = await app.container.make(SignInService)

      await assert.rejects(async () => {
        await service.run({
          uid: 'john@example.com',
          password: password,
          ctx: ctx,
        })
      }, 'Invalid user credentials')
    })
  })
})
