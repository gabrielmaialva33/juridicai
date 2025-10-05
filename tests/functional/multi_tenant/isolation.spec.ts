import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { UserFactory } from '#database/factories/user_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import { ClientFactory } from '#database/factories/client_factory'
import { CaseFactory } from '#database/factories/case_factory'
import { DeadlineFactory } from '#database/factories/deadline_factory'
import { DocumentFactory } from '#database/factories/document_factory'
import TenantContextService from '#services/tenants/tenant_context_service'

test.group('Multi-Tenant Isolation', (group) => {
  group.each.setup(async () => {
    await testUtils.db().truncate()
  })

  test('users cannot access clients from other tenants', async ({ assert }) => {
    // Setup: 2 tenants with 1 client each
    const tenant1 = await TenantFactory.create()
    const tenant2 = await TenantFactory.create()

    const client1 = await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        return await ClientFactory.merge({ full_name: 'Tenant 1 Client' }).create()
      }
    )

    const client2 = await TenantContextService.run(
      { tenant_id: tenant2.id, tenant: tenant2, user_id: null, tenant_user: null },
      async () => {
        return await ClientFactory.merge({ full_name: 'Tenant 2 Client' }).create()
      }
    )

    // User from tenant1 tries to access client2 (should fail)
    const foundClient = await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        const Client = (await import('#models/client')).default
        return await Client.find(client2.id)
      }
    )

    assert.isNull(foundClient)

    // User from tenant1 can access client1 (should work)
    const ownClient = await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        const Client = (await import('#models/client')).default
        return await Client.find(client1.id)
      }
    )

    assert.isNotNull(ownClient)
    assert.equal(ownClient?.full_name, 'Tenant 1 Client')
  })

  test('users cannot access cases from other tenants', async ({ assert }) => {
    const tenant1 = await TenantFactory.create()
    const tenant2 = await TenantFactory.create()
    const user1 = await UserFactory.create()
    const user2 = await UserFactory.create()

    // Create case for tenant1
    await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        const client = await ClientFactory.create()
        return await CaseFactory.merge({
          client_id: client.id,
          responsible_lawyer_id: user1.id,
        }).create()
      }
    )

    // Create case for tenant2
    const case2 = await TenantContextService.run(
      { tenant_id: tenant2.id, tenant: tenant2, user_id: null, tenant_user: null },
      async () => {
        const client = await ClientFactory.create()
        return await CaseFactory.merge({
          client_id: client.id,
          responsible_lawyer_id: user2.id,
        }).create()
      }
    )

    // Tenant1 should not see tenant2's case
    const foundCase = await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        const Case = (await import('#models/case')).default
        return await Case.find(case2.id)
      }
    )

    assert.isNull(foundCase)
  })

  test('users cannot access deadlines from other tenants', async ({ assert }) => {
    const tenant1 = await TenantFactory.create()
    const tenant2 = await TenantFactory.create()
    const user = await UserFactory.create()

    // Create deadline for tenant1
    await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        const client = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: client.id,
          responsible_lawyer_id: user.id,
        }).create()
        await DeadlineFactory.merge({
          case_id: caseModel.id,
          responsible_id: user.id,
          title: 'Tenant 1 Deadline',
        }).create()
      }
    )

    // Create deadline for tenant2
    await TenantContextService.run(
      { tenant_id: tenant2.id, tenant: tenant2, user_id: null, tenant_user: null },
      async () => {
        const client = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: client.id,
          responsible_lawyer_id: user.id,
        }).create()
        await DeadlineFactory.merge({
          case_id: caseModel.id,
          responsible_id: user.id,
          title: 'Tenant 2 Deadline',
        }).create()
      }
    )

    // Tenant1 should only see 1 deadline
    const tenant1Deadlines = await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        const Deadline = (await import('#models/deadline')).default
        return await Deadline.all()
      }
    )

    assert.equal(tenant1Deadlines.length, 1)
    assert.equal(tenant1Deadlines[0].title, 'Tenant 1 Deadline')
  })

  test('users cannot access documents from other tenants', async ({ assert }) => {
    const tenant1 = await TenantFactory.create()
    const tenant2 = await TenantFactory.create()
    const user = await UserFactory.create()

    // Create document for tenant1
    const doc1 = await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        const client = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: client.id,
          responsible_lawyer_id: user.id,
        }).create()
        return await DocumentFactory.merge({
          case_id: caseModel.id,
          client_id: client.id,
          uploaded_by: user.id,
          title: 'Tenant 1 Document',
        }).create()
      }
    )

    // Tenant2 should not see tenant1's document
    const foundDoc = await TenantContextService.run(
      { tenant_id: tenant2.id, tenant: tenant2, user_id: null, tenant_user: null },
      async () => {
        const Document = (await import('#models/document')).default
        return await Document.find(doc1.id)
      }
    )

    assert.isNull(foundDoc)
  })

  test('count queries are isolated per tenant', async ({ assert }) => {
    const tenant1 = await TenantFactory.create()
    const tenant2 = await TenantFactory.create()

    // Create 3 clients for tenant1
    await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        await ClientFactory.createMany(3)
      }
    )

    // Create 5 clients for tenant2
    await TenantContextService.run(
      { tenant_id: tenant2.id, tenant: tenant2, user_id: null, tenant_user: null },
      async () => {
        await ClientFactory.createMany(5)
      }
    )

    // Count for tenant1
    const count1 = await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        const Client = (await import('#models/client')).default
        const result = await Client.query().count('* as total')
        return Number(result[0].$extras.total)
      }
    )

    assert.equal(count1, 3)

    // Count for tenant2
    const count2 = await TenantContextService.run(
      { tenant_id: tenant2.id, tenant: tenant2, user_id: null, tenant_user: null },
      async () => {
        const Client = (await import('#models/client')).default
        const result = await Client.query().count('* as total')
        return Number(result[0].$extras.total)
      }
    )

    assert.equal(count2, 5)
  })

  test('aggregate queries are isolated per tenant', async ({ assert }) => {
    const tenant1 = await TenantFactory.create()
    const tenant2 = await TenantFactory.create()
    const user = await UserFactory.create()

    // Create cases with different lawsuit values for tenant1
    await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        const client = await ClientFactory.create()
        await CaseFactory.merge({
          client_id: client.id,
          responsible_lawyer_id: user.id,
          case_value: 10000,
        }).create()
        await CaseFactory.merge({
          client_id: client.id,
          responsible_lawyer_id: user.id,
          case_value: 20000,
        }).create()
      }
    )

    // Create cases for tenant2
    await TenantContextService.run(
      { tenant_id: tenant2.id, tenant: tenant2, user_id: null, tenant_user: null },
      async () => {
        const client = await ClientFactory.create()
        await CaseFactory.merge({
          client_id: client.id,
          responsible_lawyer_id: user.id,
          case_value: 50000,
        }).create()
      }
    )

    // Sum for tenant1 should be 30000
    const sum1 = await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        const Case = (await import('#models/case')).default
        const result = await Case.query().sum('case_value as total')
        return Number(result[0].$extras.total)
      }
    )

    assert.equal(sum1, 30000)

    // Sum for tenant2 should be 50000
    const sum2 = await TenantContextService.run(
      { tenant_id: tenant2.id, tenant: tenant2, user_id: null, tenant_user: null },
      async () => {
        const Case = (await import('#models/case')).default
        const result = await Case.query().sum('case_value as total')
        return Number(result[0].$extras.total)
      }
    )

    assert.equal(sum2, 50000)
  })

  test('relationship queries respect tenant isolation', async ({ assert }) => {
    const tenant1 = await TenantFactory.create()
    const user = await UserFactory.create()

    // Create client with case for tenant1
    const client1 = await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        const client = await ClientFactory.create()
        await CaseFactory.merge({
          client_id: client.id,
          responsible_lawyer_id: user.id,
        }).createMany(2)
        return client
      }
    )

    // Load cases relationship - should only see tenant1 cases
    const loadedClient = await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        const Client = (await import('#models/client')).default
        const client = await Client.find(client1.id)
        await client?.load('cases')
        return client
      }
    )

    assert.equal(loadedClient?.cases.length, 2)
  })
})
