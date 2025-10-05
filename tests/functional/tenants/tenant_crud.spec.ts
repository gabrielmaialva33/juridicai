import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { UserFactory } from '#database/factories/user_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import { TenantUserFactory } from '#database/factories/tenant_user_factory'

test.group('Tenants CRUD', (group) => {
  group.each.setup(async () => {
    await testUtils.db().truncate()
  })

  test('GET /api/v1/tenants/me returns current tenant', async ({ client }) => {
    // Create user, tenant, and relationship
    const user = await UserFactory.create()
    const tenant = await TenantFactory.create()
    await TenantUserFactory.apply('owner')
      .merge({ tenant_id: tenant.id, user_id: user.id })
      .create()

    const response = await client
      .get('/api/v1/tenants/me')
      .loginAs(user)
      .header('X-Tenant-ID', tenant.id)

    response.assertStatus(200)
    response.assertBodyContains({
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      plan: tenant.plan,
    })
  })

  test('GET /api/v1/tenants returns all tenants for authenticated user', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()

    // User belongs to 2 tenants
    const tenant1 = await TenantFactory.create()
    const tenant2 = await TenantFactory.create()

    await TenantUserFactory.apply('owner')
      .merge({ tenant_id: tenant1.id, user_id: user.id })
      .create()
    await TenantUserFactory.apply('lawyer')
      .merge({ tenant_id: tenant2.id, user_id: user.id })
      .create()

    const response = await client
      .get('/api/v1/tenants')
      .loginAs(user)
      .header('X-Tenant-ID', tenant1.id)

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.data.length, 2)
  })

  test('POST /api/v1/tenants creates new tenant', async ({ client }) => {
    const user = await UserFactory.create()

    const response = await client.post('/api/v1/tenants').loginAs(user).json({
      name: 'Nova Advocacia LTDA',
      subdomain: 'nova-adv',
    })

    response.assertStatus(201)
    response.assertBodyContains({
      name: 'Nova Advocacia LTDA',
      subdomain: 'nova-adv',
      plan: 'free',
      is_active: true,
    })
  })

  test('POST /api/v1/tenants validates subdomain format', async ({ client }) => {
    const user = await UserFactory.create()

    const response = await client.post('/api/v1/tenants').loginAs(user).json({
      name: 'Test Firm',
      subdomain: 'INVALID_SUBDOMAIN!', // Should fail - uppercase and special chars
    })

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'subdomain',
        },
      ],
    })
  })

  test('POST /api/v1/tenants rejects duplicate subdomain', async ({ client }) => {
    const user = await UserFactory.create()
    await TenantFactory.merge({ subdomain: 'existing-firm' }).create()

    const response = await client.post('/api/v1/tenants').loginAs(user).json({
      name: 'Another Firm',
      subdomain: 'existing-firm',
    })

    response.assertStatus(409)
  })

  test('GET /api/v1/tenants/:id returns specific tenant', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await TenantFactory.create()
    await TenantUserFactory.apply('owner')
      .merge({ tenant_id: tenant.id, user_id: user.id })
      .create()

    const response = await client
      .get(`/api/v1/tenants/${tenant.id}`)
      .loginAs(user)
      .header('X-Tenant-ID', tenant.id)

    response.assertStatus(200)
    response.assertBodyContains({
      id: tenant.id,
      name: tenant.name,
    })
  })

  test('GET /api/v1/tenants/:id returns 404 for non-member tenant', async ({ client }) => {
    const user = await UserFactory.create()
    const otherTenant = await TenantFactory.create()
    const userTenant = await TenantFactory.create()

    await TenantUserFactory.apply('owner')
      .merge({ tenant_id: userTenant.id, user_id: user.id })
      .create()

    const response = await client
      .get(`/api/v1/tenants/${otherTenant.id}`)
      .loginAs(user)
      .header('X-Tenant-ID', userTenant.id)

    response.assertStatus(404)
  })

  test('PUT /api/v1/tenants/:id updates tenant', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await TenantFactory.create()
    await TenantUserFactory.apply('owner')
      .merge({ tenant_id: tenant.id, user_id: user.id })
      .create()

    const response = await client
      .put(`/api/v1/tenants/${tenant.id}`)
      .loginAs(user)
      .header('X-Tenant-ID', tenant.id)
      .json({
        name: 'Updated Name',
        max_users: 50,
      })

    response.assertStatus(200)
    response.assertBodyContains({
      id: tenant.id,
      name: 'Updated Name',
      max_users: 50,
    })
  })

  test('PUT /api/v1/tenants/:id requires owner or admin role', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await TenantFactory.create()
    await TenantUserFactory.apply('lawyer') // Not owner or admin
      .merge({ tenant_id: tenant.id, user_id: user.id })
      .create()

    const response = await client
      .put(`/api/v1/tenants/${tenant.id}`)
      .loginAs(user)
      .header('X-Tenant-ID', tenant.id)
      .json({
        name: 'Should Fail',
      })

    response.assertStatus(403)
  })

  test('DELETE /api/v1/tenants/:id deactivates tenant', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await TenantFactory.create()
    await TenantUserFactory.apply('owner')
      .merge({ tenant_id: tenant.id, user_id: user.id })
      .create()

    const response = await client
      .delete(`/api/v1/tenants/${tenant.id}`)
      .loginAs(user)
      .header('X-Tenant-ID', tenant.id)

    response.assertStatus(204)

    // Verify tenant is inactive
    await tenant.refresh()
    assert.isFalse(tenant.is_active)
  })

  test('unauthenticated requests return 401', async ({ client }) => {
    const response = await client.get('/api/v1/tenants')

    response.assertStatus(401)
  })

  test('requests without X-Tenant-ID header use default tenant', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await TenantFactory.create()
    await TenantUserFactory.apply('owner')
      .merge({ tenant_id: tenant.id, user_id: user.id })
      .create()

    // Request without X-Tenant-ID header
    const response = await client.get('/api/v1/tenants/me').loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({
      id: tenant.id,
    })
  })
})
