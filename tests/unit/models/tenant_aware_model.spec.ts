import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Client from '#models/client'
import { TenantFactory } from '#database/factories/tenant_factory'
import { ClientFactory } from '#database/factories/client_factory'
import TenantContextService from '#services/tenants/tenant_context_service'

test.group('TenantAwareModel', (group) => {
  group.each.setup(async () => {
    await testUtils.db().truncate()
  })

  test('automatically assigns tenant_id on create when context is set', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const client = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await ClientFactory.merge({
          // Don't set tenant_id manually - should be auto-assigned
          full_name: 'John Doe',
        }).create()
      }
    )

    await client.refresh()
    assert.equal(client.tenant_id, tenant.id)
  })

  test('throws error when creating without tenant context', async ({ assert }) => {
    await assert.rejects(async () => {
      await ClientFactory.create()
    }, 'No tenant ID in current context')
  })

  test('automatically scopes queries to current tenant on find', async ({ assert }) => {
    const tenant1 = await TenantFactory.create()
    const tenant2 = await TenantFactory.create()

    // Create client for tenant 1
    const client1 = await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        return await ClientFactory.merge({
          full_name: 'Tenant 1 Client',
        }).create()
      }
    )

    // Create client for tenant 2
    const client2 = await TenantContextService.run(
      { tenant_id: tenant2.id, tenant: tenant2, user_id: null, tenant_user: null },
      async () => {
        return await ClientFactory.merge({
          full_name: 'Tenant 2 Client',
        }).create()
      }
    )

    // Query from tenant 1 context - should only see client1
    const foundClient = await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        return await Client.find(client1.id)
      }
    )

    assert.isNotNull(foundClient)
    assert.equal(foundClient?.full_name, 'Tenant 1 Client')

    // Try to find tenant 2's client from tenant 1 context - should return null
    const notFoundClient = await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        return await Client.find(client2.id)
      }
    )

    assert.isNull(notFoundClient)
  })

  test('automatically scopes queries to current tenant on all', async ({ assert }) => {
    const tenant1 = await TenantFactory.create()
    const tenant2 = await TenantFactory.create()

    // Create 3 clients for tenant 1
    await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        await ClientFactory.createMany(3)
      }
    )

    // Create 2 clients for tenant 2
    await TenantContextService.run(
      { tenant_id: tenant2.id, tenant: tenant2, user_id: null, tenant_user: null },
      async () => {
        await ClientFactory.createMany(2)
      }
    )

    // Query from tenant 1 - should only see 3 clients
    const tenant1Clients = await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        return await Client.all()
      }
    )

    assert.equal(tenant1Clients.length, 3)

    // Query from tenant 2 - should only see 2 clients
    const tenant2Clients = await TenantContextService.run(
      { tenant_id: tenant2.id, tenant: tenant2, user_id: null, tenant_user: null },
      async () => {
        return await Client.all()
      }
    )

    assert.equal(tenant2Clients.length, 2)
  })

  test('allows manual tenant_id override on create', async ({ assert }) => {
    const tenant1 = await TenantFactory.create()
    const tenant2 = await TenantFactory.create()

    // Create client with explicit tenant_id different from context
    const client = await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        return await Client.create({
          tenant_id: tenant2.id, // Explicit override
          client_type: 'individual',
          full_name: 'Override Client',
          cpf: '123.456.789-00',
          phone: '(11) 99999-9999',
          email: 'override@test.com',
          is_active: true,
        })
      }
    )

    assert.equal(client.tenant_id, tenant2.id)
  })

  test('query scope works with where clauses', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        await ClientFactory.merge({ full_name: 'Active Client', is_active: true }).create()
        await ClientFactory.merge({ full_name: 'Inactive Client', is_active: false }).create()
      }
    )

    const activeClients = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await Client.query().where('is_active', true)
      }
    )

    assert.equal(activeClients.length, 1)
    assert.equal(activeClients[0].full_name, 'Active Client')
  })

  test('first() method respects tenant scoping', async ({ assert }) => {
    const tenant1 = await TenantFactory.create()
    const tenant2 = await TenantFactory.create()

    await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        await ClientFactory.merge({ full_name: 'Tenant 1 First' }).create()
      }
    )

    await TenantContextService.run(
      { tenant_id: tenant2.id, tenant: tenant2, user_id: null, tenant_user: null },
      async () => {
        await ClientFactory.merge({ full_name: 'Tenant 2 First' }).create()
      }
    )

    const tenant1First = await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        return await Client.first()
      }
    )

    assert.equal(tenant1First?.full_name, 'Tenant 1 First')

    const tenant2First = await TenantContextService.run(
      { tenant_id: tenant2.id, tenant: tenant2, user_id: null, tenant_user: null },
      async () => {
        return await Client.first()
      }
    )

    assert.equal(tenant2First?.full_name, 'Tenant 2 First')
  })
})
