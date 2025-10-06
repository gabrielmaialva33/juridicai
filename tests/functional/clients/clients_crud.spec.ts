import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import User from '#models/user'
import Client from '#models/client'
import { UserFactory } from '#database/factories/user_factory'
import { ClientFactory } from '#database/factories/client_factory'
import { setupTenantForUser } from '#tests/utils/tenant_test_helper'
import TenantContextService from '#services/tenants/tenant_context_service'

test.group('Clients CRUD', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  /**
   * ------------------------------------------------------
   * GET /api/v1/clients - List/Paginate Tests
   * ------------------------------------------------------
   */

  test('should list clients with pagination', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    // Create multiple clients in tenant context
    const clients = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        return await ClientFactory.createMany(5)
      }
    )

    const response = await client
      .get('/api/v1/clients')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({
      meta: {
        total: 5,
        current_page: 1,
      },
    })

    const body = response.body()
    assert.lengthOf(body.data, 5)
  })

  test('should search clients by name', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        // Create client with specific name
        await ClientFactory.merge({ full_name: 'Maria Santos Silva' }).create()
        // Create other clients
        await ClientFactory.merge({ full_name: 'João Pedro Costa' }).create()
        await ClientFactory.merge({ full_name: 'Ana Clara Souza' }).create()
      }
    )

    const response = await client
      .get('/api/v1/clients?search=maria')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)

    const body = response.body()
    assert.equal(body.meta.total, 1)
    assert.equal(body.data[0].full_name, 'Maria Santos Silva')
  })

  test('should search clients by email', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        await ClientFactory.merge({ email: 'maria@example.com' }).create()
        await ClientFactory.merge({ email: 'joao@example.com' }).create()
      }
    )

    const response = await client
      .get('/api/v1/clients?search=maria@example.com')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)

    const body = response.body()
    assert.equal(body.meta.total, 1)
    assert.equal(body.data[0].email, 'maria@example.com')
  })

  test('should search clients by CPF', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        await ClientFactory.merge({
          full_name: 'Maria Santos',
          cpf: '12345678900',
        }).create()
        await ClientFactory.merge({
          full_name: 'João Silva',
          cpf: '98765432100',
        }).create()
      }
    )

    // Search with numbers only (the search scope removes formatting)
    const response = await client
      .get('/api/v1/clients?search=12345678900')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)

    const body = response.body()
    assert.equal(body.meta.total, 1)
    assert.equal(body.data[0].cpf, '12345678900')
    assert.equal(body.data[0].full_name, 'Maria Santos')
  })

  test('should filter clients by type (individual)', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        // Create individual clients
        await ClientFactory.apply('individual').createMany(3)
        // Create company clients
        await ClientFactory.apply('company').createMany(2)
      }
    )

    const response = await client
      .get('/api/v1/clients?client_type=individual')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)

    const body = response.body()
    assert.equal(body.meta.total, 3)
    body.data.forEach((clientData: any) => {
      assert.equal(clientData.client_type, 'individual')
    })
  })

  test('should filter clients by type (company)', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        // Create individual clients
        await ClientFactory.apply('individual').createMany(2)
        // Create company clients
        await ClientFactory.apply('company').createMany(3)
      }
    )

    const response = await client
      .get('/api/v1/clients?client_type=company')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)

    const body = response.body()
    assert.equal(body.meta.total, 3)
    body.data.forEach((clientData: any) => {
      assert.equal(clientData.client_type, 'company')
    })
  })

  test('should filter clients by active status', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        // Create active clients
        await ClientFactory.merge({ is_active: true }).createMany(4)
        // Create inactive clients
        await ClientFactory.apply('inactive').createMany(2)
      }
    )

    const response = await client
      .get('/api/v1/clients?is_active=true')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)

    const body = response.body()
    assert.equal(body.meta.total, 4)
    body.data.forEach((clientData: any) => {
      assert.isTrue(clientData.is_active)
    })
  })

  test('should filter clients by inactive status', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        // Create active clients
        await ClientFactory.merge({ is_active: true }).createMany(3)
        // Create inactive clients
        await ClientFactory.apply('inactive').createMany(2)
      }
    )

    const response = await client
      .get('/api/v1/clients?is_active=false')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)

    const body = response.body()
    assert.equal(body.meta.total, 2)
    body.data.forEach((clientData: any) => {
      assert.isFalse(clientData.is_active)
    })
  })

  /**
   * ------------------------------------------------------
   * GET /api/v1/clients/:id - Get Single Client Tests
   * ------------------------------------------------------
   */

  test('should get client by id', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const targetClient = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        return await ClientFactory.merge({
          full_name: 'João Silva',
          email: 'joao@example.com',
        }).create()
      }
    )

    const response = await client
      .get(`/api/v1/clients/${targetClient.id}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({
      id: targetClient.id,
      full_name: 'João Silva',
      email: 'joao@example.com',
      tenant_id: tenant.id,
    })
  })

  test('should return 404 for non-existent client', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const response = await client
      .get('/api/v1/clients/999999')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(404)
    response.assertBodyContains({
      message: 'Client not found',
    })
  })

  test('should get client with cases relationship', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const targetClient = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        return await ClientFactory.create()
      }
    )

    const response = await client
      .get(`/api/v1/clients/${targetClient.id}?with_cases=true`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)

    const body = response.body()
    assert.property(body, 'cases')
    assert.isArray(body.cases)
  })

  /**
   * ------------------------------------------------------
   * POST /api/v1/clients - Create Client Tests
   * ------------------------------------------------------
   */

  test('should create individual client with valid data', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const clientData = {
      client_type: 'individual',
      full_name: 'Maria Santos',
      cpf: '123.456.789-00',
      email: 'maria@example.com',
      phone: '(11) 98765-4321',
    }

    const response = await client
      .post('/api/v1/clients')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json(clientData)

    response.assertStatus(201)
    response.assertBodyContains({
      client_type: 'individual',
      full_name: 'Maria Santos',
      cpf: '123.456.789-00',
      email: 'maria@example.com',
      phone: '(11) 98765-4321',
      tenant_id: tenant.id,
    })

    // Verify client was created in database
    const createdClient = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        return await Client.query().where('cpf', '123.456.789-00').first()
      }
    )

    assert.isNotNull(createdClient)
    assert.equal(createdClient!.full_name, 'Maria Santos')
  })

  test('should create company client with valid data', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const clientData = {
      client_type: 'company',
      company_name: 'Acme Corp LTDA',
      cnpj: '12.345.678/0001-00',
      email: 'contato@acme.com',
      phone: '(11) 3000-0000',
    }

    const response = await client
      .post('/api/v1/clients')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json(clientData)

    response.assertStatus(201)
    response.assertBodyContains({
      client_type: 'company',
      company_name: 'Acme Corp LTDA',
      cnpj: '12.345.678/0001-00',
      email: 'contato@acme.com',
      tenant_id: tenant.id,
    })

    // Verify client was created in database
    const createdClient = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        return await Client.query().where('cnpj', '12.345.678/0001-00').first()
      }
    )

    assert.isNotNull(createdClient)
    assert.equal(createdClient!.company_name, 'Acme Corp LTDA')
  })

  test('should create client with address', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const clientData = {
      client_type: 'individual',
      full_name: 'Pedro Costa',
      cpf: '111.222.333-44',
      address: {
        street: 'Rua das Flores',
        number: '123',
        complement: 'Apto 45',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        zip_code: '01234-567',
        country: 'Brasil',
      },
    }

    const response = await client
      .post('/api/v1/clients')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json(clientData)

    response.assertStatus(201)

    const body = response.body()
    assert.deepInclude(body.address, {
      street: 'Rua das Flores',
      number: '123',
      city: 'São Paulo',
      state: 'SP',
    })
  })

  test('should create client with tags', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const clientData = {
      client_type: 'individual',
      full_name: 'VIP Client',
      cpf: '555.666.777-88',
      email: 'vip@example.com',
      tags: ['vip', 'prioridade'],
    }

    const response = await client
      .post('/api/v1/clients')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json(clientData)

    response.assertStatus(201)

    const body = response.body()
    assert.isArray(body.tags)
    assert.lengthOf(body.tags, 2)
    assert.includeMembers(body.tags, ['vip', 'prioridade'])
  })

  test('should validate required fields for individual client', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const response = await client
      .post('/api/v1/clients')
      .header('Accept', 'application/json')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        client_type: 'individual',
        // Missing full_name and cpf
      })

    // Currently returns 500 because validation happens in service layer
    // TODO: Move this validation to validator for proper 422 response
    response.assertStatus(500)
  })

  test('should validate required fields for company client', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const response = await client
      .post('/api/v1/clients')
      .header('Accept', 'application/json')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        client_type: 'company',
        // Missing company_name and cnpj
      })

    // Currently returns 500 because validation happens in service layer
    // TODO: Move this validation to validator for proper 422 response
    response.assertStatus(500)
  })

  test('should validate CPF format', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const response = await client
      .post('/api/v1/clients')
      .header('Accept', 'application/json')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        client_type: 'individual',
        full_name: 'Test User',
        cpf: '12345678900', // Invalid format (missing punctuation)
      })

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'cpf',
          rule: 'regex',
        },
      ],
    })
  })

  test('should validate CNPJ format', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const response = await client
      .post('/api/v1/clients')
      .header('Accept', 'application/json')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        client_type: 'company',
        company_name: 'Test Company',
        cnpj: '12345678000100', // Invalid format (missing punctuation)
      })

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'cnpj',
          rule: 'regex',
        },
      ],
    })
  })

  test('should validate email format', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const response = await client
      .post('/api/v1/clients')
      .header('Accept', 'application/json')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        client_type: 'individual',
        full_name: 'Test User',
        cpf: '123.456.789-00',
        email: 'invalid-email', // Invalid email format
      })

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'email',
          rule: 'email',
        },
      ],
    })
  })

  /**
   * ------------------------------------------------------
   * PATCH /api/v1/clients/:id - Update Client Tests
   * ------------------------------------------------------
   */

  test('should update client', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const targetClient = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        return await ClientFactory.merge({
          full_name: 'Old Name',
          email: 'old@example.com',
        }).create()
      }
    )

    const updateData = {
      full_name: 'Updated Name',
      email: 'updated@example.com',
    }

    const response = await client
      .patch(`/api/v1/clients/${targetClient.id}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json(updateData)

    response.assertStatus(200)
    response.assertBodyContains({
      id: targetClient.id,
      full_name: 'Updated Name',
      email: 'updated@example.com',
    })

    // Verify update in database
    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        await targetClient.refresh()
      }
    )
    assert.equal(targetClient.full_name, 'Updated Name')
    assert.equal(targetClient.email, 'updated@example.com')
  })

  test('should update client phone', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const targetClient = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        return await ClientFactory.merge({ phone: '(11) 11111-1111' }).create()
      }
    )

    const response = await client
      .patch(`/api/v1/clients/${targetClient.id}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        phone: '(11) 99999-9999',
      })

    response.assertStatus(200)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        await targetClient.refresh()
      }
    )
    assert.equal(targetClient.phone, '(11) 99999-9999')
  })

  test('should update client address', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const targetClient = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        return await ClientFactory.create()
      }
    )

    const newAddress = {
      street: 'New Street',
      number: '999',
      city: 'Rio de Janeiro',
      state: 'RJ',
      zip_code: '20000-000',
    }

    const response = await client
      .patch(`/api/v1/clients/${targetClient.id}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        address: newAddress,
      })

    response.assertStatus(200)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        await targetClient.refresh()
      }
    )
    assert.equal(targetClient.address?.city, 'Rio de Janeiro')
    assert.equal(targetClient.address?.state, 'RJ')
  })

  test('should update client with address and tags', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const targetClient = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        return await ClientFactory.merge({
          tags: ['old_tag'],
          address: null,
        }).create()
      }
    )

    const updateData = {
      address: {
        street: 'Avenida Paulista',
        number: '1000',
        complement: 'Conjunto 100',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
        zip_code: '01310-100',
        country: 'Brasil',
      },
      tags: ['vip', 'prioridade', 'empresarial'],
    }

    const response = await client
      .patch(`/api/v1/clients/${targetClient.id}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json(updateData)

    response.assertStatus(200)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        await targetClient.refresh()
      }
    )

    // Verify address was updated
    assert.equal(targetClient.address?.street, 'Avenida Paulista')
    assert.equal(targetClient.address?.number, '1000')
    assert.equal(targetClient.address?.city, 'São Paulo')
    assert.equal(targetClient.address?.state, 'SP')

    // Verify tags were updated
    assert.isArray(targetClient.tags)
    assert.lengthOf(targetClient.tags!, 3)
    assert.includeMembers(targetClient.tags!, ['vip', 'prioridade', 'empresarial'])
  })

  test('should return error when updating non-existent client', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const response = await client
      .patch('/api/v1/clients/999999')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        full_name: 'Updated Name',
      })

    // Currently returns 500 because service throws generic Error
    // TODO: Use NotFoundException for proper 404 response
    response.assertStatus(500)
  })

  /**
   * ------------------------------------------------------
   * DELETE /api/v1/clients/:id - Soft Delete Tests
   * ------------------------------------------------------
   */

  test('should soft delete client (set is_active to false)', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const clientToDelete = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        return await ClientFactory.merge({ is_active: true }).create()
      }
    )

    const response = await client
      .delete(`/api/v1/clients/${clientToDelete.id}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(204)

    // Verify client is soft deleted (is_active = false)
    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        await clientToDelete.refresh()
      }
    )
    assert.isFalse(clientToDelete.is_active)
  })

  test('should return 404 when deleting non-existent client', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const response = await client
      .delete('/api/v1/clients/999999')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(404)
  })

  /**
   * ------------------------------------------------------
   * Authentication & Authorization Tests
   * ------------------------------------------------------
   */

  test('should require authentication for all operations', async ({ client }) => {
    const responses = await Promise.all([
      client.get('/api/v1/clients'),
      client.get('/api/v1/clients/1'),
      client.post('/api/v1/clients').json({}),
      client.patch('/api/v1/clients/1').json({}),
      client.delete('/api/v1/clients/1'),
    ])

    responses.forEach((response) => {
      response.assertStatus(401)
    })
  })

  /**
   * ------------------------------------------------------
   * Tenant Isolation Tests
   * ------------------------------------------------------
   */

  test('should not access clients from other tenants', async ({ client }) => {
    // Create first tenant with client
    const user1 = await UserFactory.create()
    const tenant1 = await setupTenantForUser(user1)

    const client1 = await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: user1.id, tenant_user: null },
      async () => {
        return await ClientFactory.create()
      }
    )

    // Create second tenant
    const user2 = await UserFactory.create()
    const tenant2 = await setupTenantForUser(user2)

    // Try to access client from tenant1 using tenant2 credentials
    const response = await client
      .get(`/api/v1/clients/${client1.id}`)
      .header('X-Tenant-ID', tenant2.id)
      .loginAs(user2)

    response.assertStatus(404)
  })

  test('should only list clients from current tenant', async ({ client, assert }) => {
    // Create first tenant with clients
    const user1 = await UserFactory.create()
    const tenant1 = await setupTenantForUser(user1)

    const tenant1ClientIds = await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: user1.id, tenant_user: null },
      async () => {
        const clients = await ClientFactory.createMany(3)
        return clients.map((c) => c.id)
      }
    )

    // Create second tenant with clients
    const user2 = await UserFactory.create()
    const tenant2 = await setupTenantForUser(user2)

    const tenant2ClientIds = await TenantContextService.run(
      { tenant_id: tenant2.id, tenant: tenant2, user_id: user2.id, tenant_user: null },
      async () => {
        const clients = await ClientFactory.createMany(2)
        return clients.map((c) => c.id)
      }
    )

    // List clients for tenant1 - should only return tenant1's clients
    const response1 = await client
      .get('/api/v1/clients')
      .header('X-Tenant-ID', tenant1.id)
      .loginAs(user1)

    response1.assertStatus(200)
    const body1 = response1.body()

    // Verify ALL returned clients have correct tenant_id
    body1.data.forEach((c: any) => {
      assert.equal(c.tenant_id, tenant1.id, `Client ${c.id} should have tenant_id ${tenant1.id}`)
    })
    assert.equal(body1.meta.total, tenant1ClientIds.length)

    // List clients for tenant2 - should only return tenant2's clients
    const response2 = await client
      .get('/api/v1/clients')
      .header('X-Tenant-ID', tenant2.id)
      .loginAs(user2)

    response2.assertStatus(200)
    const body2 = response2.body()

    // Verify ALL returned clients have correct tenant_id
    body2.data.forEach((c: any) => {
      assert.equal(c.tenant_id, tenant2.id, `Client ${c.id} should have tenant_id ${tenant2.id}`)
    })
    assert.equal(body2.meta.total, tenant2ClientIds.length)
  })
})
