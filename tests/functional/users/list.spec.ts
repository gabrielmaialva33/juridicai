import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'

import Role from '#models/role'
import Permission from '#models/permission'
import User from '#models/user'

import IPermission from '#interfaces/permission_interface'
import IRole from '#interfaces/role_interface'
import { TenantUserRole } from '#models/tenant_user'
import { setupTenantForUser } from '#tests/utils/tenant_test_helper'
import { assignPermissions } from '#tests/utils/permission_test_helper'

test.group('Users List', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should list users with authentication', async ({ client }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const user = await User.create({
      full_name: 'John Doe',
      email: 'john@example.com',
      username: 'johndoe',
      password: 'password123',
    })

    await db.table('user_roles').insert({
      user_id: user.id,
      role_id: userRole.id,
    })

    // Setup tenant for user
    const tenant = await setupTenantForUser(user)

    // Assign list permission to user role
    await assignPermissions(userRole, [IPermission.Actions.LIST])

    const response = await client
      .get('/api/v1/users')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({
      meta: {
        per_page: 10,
        current_page: 1,
      },
    })
    // Check that the response contains users
    response.assert!.isArray(response.body().data)
    response.assert!.isAtLeast(response.body().data.length, 1)
  })

  test('should fail without authentication', async ({ client }) => {
    const response = await client.get('/api/v1/users')

    response.assertStatus(401)
  })

  test('should paginate results', async ({ client, assert }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const authUser = await User.create({
      full_name: 'Auth User',
      email: 'auth@example.com',
      username: 'authuser',
      password: 'password123',
    })

    await db.table('user_roles').insert({
      user_id: authUser.id,
      role_id: userRole.id,
    })

    // Setup tenant for user
    const tenant = await setupTenantForUser(authUser)

    // Assign list permission to user role
    await assignPermissions(userRole, [IPermission.Actions.LIST])

    // Create 15 additional users in the same tenant
    for (let i = 1; i <= 15; i++) {
      const newUser = await User.create({
        full_name: `User${i} Test`,
        email: `user${i}@example.com`,
        username: `user${i}`,
        password: 'password123',
      })
      await setupTenantForUser(newUser, TenantUserRole.LAWYER, tenant)
    }

    const response = await client
      .get('/api/v1/users')
      .header('X-Tenant-ID', tenant.id)
      .qs({ page: 2, per_page: 10 })
      .loginAs(authUser)

    response.assertStatus(200)
    response.assertBodyContains({
      meta: {
        per_page: 10,
        current_page: 2,
      },
    })

    const data = response.body().data
    // Check that pagination is working - should have some data on page 2
    assert.isArray(data)
    assert.isAtLeast(data.length, 1)
  })

  test('should filter users by search query', async ({ client, assert }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const authUser = await User.create({
      full_name: 'John Doe',
      email: 'john@example.com',
      username: 'johndoe',
      password: 'password123',
    })

    await db.table('user_roles').insert({
      user_id: authUser.id,
      role_id: userRole.id,
    })

    // Setup tenant for user
    const tenant = await setupTenantForUser(authUser)

    // Assign list permission to user role
    await assignPermissions(userRole, [IPermission.Actions.LIST])

    const janeUser = await User.create({
      full_name: 'Jane Smith',
      email: 'jane@example.com',
      username: 'janesmith',
      password: 'password123',
    })
    await setupTenantForUser(janeUser, TenantUserRole.LAWYER, tenant)

    const bobUser = await User.create({
      full_name: 'Bob Johnson',
      email: 'bob@example.com',
      username: 'bobjohnson',
      password: 'password123',
    })
    await setupTenantForUser(bobUser, TenantUserRole.LAWYER, tenant)

    const response = await client
      .get('/api/v1/users')
      .header('X-Tenant-ID', tenant.id)
      .qs({ search: 'jane' })
      .loginAs(authUser)

    response.assertStatus(200)
    const data = response.body().data
    assert.lengthOf(data, 1)
    response.assertBodyContains({
      data: [
        {
          email: 'jane@example.com',
          username: 'janesmith',
        },
      ],
    })
  })

  test('should sort users by different fields', async ({ client }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const authUser = await User.create({
      full_name: 'Auth User',
      email: 'auth@example.com',
      username: 'authuser',
      password: 'password123',
    })

    await db.table('user_roles').insert({
      user_id: authUser.id,
      role_id: userRole.id,
    })

    // Setup tenant for user
    const tenant = await setupTenantForUser(authUser)

    // Assign list permission to user role
    await assignPermissions(userRole, [IPermission.Actions.LIST])

    const charlieUser = await User.create({
      full_name: 'Charlie Brown',
      email: 'charlie@example.com',
      username: 'charliebrown',
      password: 'password123',
    })
    await setupTenantForUser(charlieUser, TenantUserRole.LAWYER, tenant)

    const aliceUser = await User.create({
      full_name: 'Alice Wonder',
      email: 'alice@example.com',
      username: 'alicewonder',
      password: 'password123',
    })
    await setupTenantForUser(aliceUser, TenantUserRole.LAWYER, tenant)

    const response = await client
      .get('/api/v1/users')
      .header('X-Tenant-ID', tenant.id)
      .qs({ sort_by: 'full_name', order: 'asc' })
      .loginAs(authUser)

    response.assertStatus(200)
    const data = response.body().data

    // Find the specific users we created in the results
    const userNames = data.map((u: any) => u.full_name)
    const aliceIndex = userNames.indexOf('Alice Wonder')
    const authIndex = userNames.indexOf('Auth User')
    const charlieIndex = userNames.indexOf('Charlie Brown')

    // Check they exist and are in ascending order
    response.assert!.isAtLeast(aliceIndex, 0)
    response.assert!.isAtLeast(authIndex, 0)
    response.assert!.isAtLeast(charlieIndex, 0)
    response.assert!.isBelow(aliceIndex, authIndex)
    response.assert!.isBelow(authIndex, charlieIndex)
  })

  test('should include user roles in response', async ({ client }) => {
    // Create unique user first to avoid conflicts
    const user = await User.create({
      full_name: 'John Doe Test Roles',
      email: `john.roles.${Date.now()}@example.com`,
      username: `johndoe${Date.now()}`,
      password: 'password123',
    })

    const userRole = await Role.updateOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const adminRole = await Role.updateOrCreate(
      { slug: IRole.Slugs.ADMIN },
      {
        name: 'Admin',
        slug: IRole.Slugs.ADMIN,
        description: 'Administrator role',
      }
    )

    // Clear any existing permissions from roles
    await userRole.related('permissions').sync([])
    await adminRole.related('permissions').sync([])

    // Attach roles to user
    await user.related('roles').sync([userRole.id, adminRole.id])

    // Setup tenant for user
    const tenant = await setupTenantForUser(user)

    // Assign list permission to user role (admin inherits this too)
    await assignPermissions(userRole, [IPermission.Actions.LIST])

    const response = await client
      .get('/api/v1/users')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)

    // Find the specific user we created in the response
    const responseData = response.body().data
    const createdUser = responseData.find((u: any) => u.id === user.id)

    // Debug logging
    logger.info('Created user ID: %s', user.id)
    logger.info('Response users count: %s', responseData.length)
    if (createdUser) {
      logger.info('Found user roles: %o', createdUser.roles)
    } else {
      logger.info('User not found in response')
      logger.info(
        'Available user IDs: %o',
        responseData.map((u: any) => u.id)
      )
    }

    response.assert!.exists(createdUser, 'User should be in response')
    response.assert!.equal(createdUser.id, user.id)
    response.assert!.lengthOf(createdUser.roles, 2, 'User should have 2 roles')

    const roleSlugs = createdUser.roles.map((r: any) => r.slug).sort()
    response.assert!.deepEqual(roleSlugs, [IRole.Slugs.ADMIN, IRole.Slugs.USER].sort())
  })
})
