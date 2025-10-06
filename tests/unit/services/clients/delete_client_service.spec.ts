import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'

import DeleteClientService from '#services/clients/delete_client_service'
import { ClientFactory } from '#database/factories/client_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import TenantContextService from '#services/tenants/tenant_context_service'
import Client from '#models/client'

test.group('DeleteClientService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should soft delete client (set is_active to false)', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const service = await app.container.make(DeleteClientService)

    const client = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await ClientFactory.merge({ is_active: true }).create()
      }
    )

    assert.isTrue(client.is_active, 'Client should be active initially')

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        await service.run(client.id)
        // Reload client within tenant context
        await client.refresh()
      }
    )

    assert.isFalse(client.is_active, 'Client should be soft deleted (is_active = false)')
  })

  test('should not hard delete client', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const service = await app.container.make(DeleteClientService)

    const client = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await ClientFactory.create()
      }
    )

    const clientId = client.id

    const clientStillExists = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        await service.run(clientId)

        // Try to find the client directly bypassing tenant scope
        return await Client.withoutTenantScope().where('id', clientId).first()
      }
    )

    assert.exists(clientStillExists, 'Client should still exist in database (not hard deleted)')
  })

  test('should preserve client data after deletion', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const service = await app.container.make(DeleteClientService)

    const originalData = {
      full_name: 'John Doe',
      email: 'john@example.com',
      phone: '(11) 98765-4321',
      is_active: true,
    }

    const client = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await ClientFactory.merge(originalData).create()
      }
    )

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        await service.run(client.id)
        // Reload client within tenant context
        await client.refresh()
      }
    )

    assert.equal(client.full_name, originalData.full_name, 'Full name should be preserved')
    assert.equal(client.email, originalData.email, 'Email should be preserved')
    assert.equal(client.phone, originalData.phone, 'Phone should be preserved')
    assert.isFalse(client.is_active, 'Only is_active should change')
  })

  test('should throw error if client not found', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const service = await app.container.make(DeleteClientService)

    await assert.rejects(async () => {
      await TenantContextService.run(
        { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
        async () => {
          await service.run(99999)
        }
      )
    }, 'Client not found')
  })
})
