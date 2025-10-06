import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'
import { ClientFactory } from '#database/factories/client_factory'
import { CaseFactory } from '#database/factories/case_factory'
import { CaseEventFactory } from '#database/factories/case_event_factory'
import { setupTenantForUser } from '#tests/utils/tenant_test_helper'
import TenantContextService from '#services/tenants/tenant_context_service'
import CaseEvent from '#models/case_event'

test.group('Case Events CRUD', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should list case events with pagination', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    // Create test data within tenant context
    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        // Create multiple events
        await CaseEventFactory.merge({ case_id: caseModel.id }).createMany(5)
      }
    )

    const response = await client
      .get('/api/v1/case-events')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.property(body, 'meta')
    assert.property(body, 'data')
    assert.equal(body.data.length, 5)
  })

  test('should filter case events by case_id', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const { case1 } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const createdCase1 = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()
        const case2 = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        // Create events for both cases
        await CaseEventFactory.merge({ case_id: createdCase1.id }).createMany(3)
        await CaseEventFactory.merge({ case_id: case2.id }).createMany(2)

        return { case1: createdCase1 }
      }
    )

    const response = await client
      .get(`/api/v1/case-events?case_id=${case1.id}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.data.length, 3)
    body.data.forEach((event: any) => {
      assert.equal(event.case_id, case1.id)
    })
  })

  test('should filter case events by event_type', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        // Create events with different types
        await CaseEventFactory.merge({ case_id: caseModel.id }).apply('filing').createMany(2)
        await CaseEventFactory.merge({ case_id: caseModel.id }).apply('hearing').createMany(3)
        await CaseEventFactory.merge({ case_id: caseModel.id }).apply('decision').create()

        return { caseModel }
      }
    )

    const response = await client
      .get('/api/v1/case-events?event_type=filing')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.data.length, 2)
    body.data.forEach((event: any) => {
      assert.equal(event.event_type, 'filing')
    })
  })

  test('should filter case events by source', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        // Create events with different sources
        await CaseEventFactory.merge({
          case_id: caseModel.id,
          source: 'court_api',
        }).createMany(3)
        await CaseEventFactory.merge({
          case_id: caseModel.id,
          source: 'manual',
        }).createMany(2)

        return { caseModel }
      }
    )

    const response = await client
      .get('/api/v1/case-events?source=court_api')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.data.length, 3)
    body.data.forEach((event: any) => {
      assert.equal(event.source, 'court_api')
    })
  })

  test('should get case event by id', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const { event } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        const createdEvent = await CaseEventFactory.merge({
          case_id: caseModel.id,
          event_type: 'filing',
          title: 'Processo Distribuído',
          source: 'manual',
        }).create()

        return { event: createdEvent }
      }
    )

    const response = await client
      .get(`/api/v1/case-events/${event.id}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({
      id: event.id,
      event_type: 'filing',
      title: 'Processo Distribuído',
      source: 'manual',
    })
  })

  test('should get case event with case relationship preloaded', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const { event, caseModel } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const createdCase = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        const createdEvent = await CaseEventFactory.merge({
          case_id: createdCase.id,
          event_type: 'hearing',
          title: 'Audiência de Conciliação',
        }).create()

        return { event: createdEvent, caseModel: createdCase }
      }
    )

    const response = await client
      .get(`/api/v1/case-events/${event.id}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    const body = response.body()

    // Verify case relationship is preloaded
    assert.property(body, 'case')
    assert.equal(body.case.id, caseModel.id)

    // Verify case has client preloaded
    assert.property(body.case, 'client')
  })

  test('should return 404 for non-existent case event', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const response = await client
      .get('/api/v1/case-events/999999')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(404)
    response.assertBodyContains({
      message: 'Case event not found',
    })
  })

  test('should create case event with valid data', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const { caseModel } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const createdCase = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        return { caseModel: createdCase }
      }
    )

    const eventDate = DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss')
    const response = await client
      .post('/api/v1/case-events')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        case_id: caseModel.id,
        event_type: 'filing',
        title: 'Processo Distribuído',
        description: 'Processo distribuído para a 1ª Vara Cível',
        event_date: eventDate,
        source: 'manual',
      })

    response.assertStatus(201)
    const body = response.body()

    assert.equal(body.case_id, caseModel.id)
    assert.equal(body.event_type, 'filing')
    assert.equal(body.title, 'Processo Distribuído')
    assert.equal(body.description, 'Processo distribuído para a 1ª Vara Cível')
    assert.equal(body.source, 'manual')
    assert.property(body, 'id')
    assert.property(body, 'created_at')
    assert.property(body, 'updated_at')

    // Verify created_by is set
    assert.equal(body.created_by, user.id)
  })

  test('should validate required fields when creating case event', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const response = await client
      .post('/api/v1/case-events')
      .header('Accept', 'application/json')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        // Missing required fields: case_id, event_type, title, event_date
        description: 'Some description',
      })

    response.assertStatus(422)
    const body = response.body()

    // Check for required field errors
    const fields = body.errors.map((e: any) => e.field)
    const expectedFields = ['case_id', 'event_type', 'title', 'event_date']

    expectedFields.forEach((field) => {
      if (!fields.includes(field)) {
        throw new Error(`Expected validation error for field: ${field}`)
      }
    })
  })

  test('should validate event_type enum when creating case event', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const { caseModel } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const createdCase = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        return { caseModel: createdCase }
      }
    )

    const response = await client
      .post('/api/v1/case-events')
      .header('Accept', 'application/json')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        case_id: caseModel.id,
        event_type: 'invalid_type', // Invalid event type
        title: 'Test Event',
        event_date: DateTime.now().toFormat('yyyy-MM-dd'),
      })

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'event_type',
          rule: 'enum',
        },
      ],
    })
  })

  test('should update case event', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const { event } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        const createdEvent = await CaseEventFactory.merge({
          case_id: caseModel.id,
          event_type: 'hearing',
          title: 'Audiência de Conciliação',
          description: 'Descrição original',
          source: 'manual',
        }).create()

        return { event: createdEvent }
      }
    )

    const response = await client
      .patch(`/api/v1/case-events/${event.id}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        title: 'Audiência de Conciliação Atualizada',
        description: 'Descrição atualizada',
      })

    response.assertStatus(200)
    response.assertBodyContains({
      id: event.id,
      title: 'Audiência de Conciliação Atualizada',
      description: 'Descrição atualizada',
    })

    // Verify in database within tenant context
    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        await event.refresh()
        assert.equal(event.title, 'Audiência de Conciliação Atualizada')
        assert.equal(event.description, 'Descrição atualizada')
      }
    )
  })

  test('should update case event with metadata', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const { event } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        const createdEvent = await CaseEventFactory.merge({
          case_id: caseModel.id,
          event_type: 'hearing',
          title: 'Audiência',
          metadata: null,
        }).create()

        return { event: createdEvent }
      }
    )

    const metadata = {
      hearing_location: 'Sala 5',
      judge: 'Dr. João Silva',
      attendees: ['Advogado A', 'Advogado B'],
    }

    const response = await client
      .patch(`/api/v1/case-events/${event.id}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({ metadata })

    response.assertStatus(200)
    const body = response.body()
    assert.property(body, 'metadata')
    assert.deepEqual(body.metadata, metadata)
  })

  test('should delete case event (hard delete)', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const { event } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        const createdEvent = await CaseEventFactory.merge({
          case_id: caseModel.id,
          event_type: 'other',
          title: 'Evento para Deletar',
        }).create()

        return { event: createdEvent }
      }
    )

    const response = await client
      .delete(`/api/v1/case-events/${event.id}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(204)

    // Verify hard delete - record should not exist
    // Query within tenant context but without tenant scope to check hard delete
    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const deletedEvent = await CaseEvent.withoutTenantScope().where('id', event.id).first()

        assert.isNull(deletedEvent)
      }
    )
  })

  test('should return 404 when deleting non-existent case event', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const response = await client
      .delete('/api/v1/case-events/999999')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(404)
  })

  test('should require authentication for all operations', async ({ client }) => {
    const responses = await Promise.all([
      client.get('/api/v1/case-events'),
      client.get('/api/v1/case-events/1'),
      client.post('/api/v1/case-events').json({}),
      client.patch('/api/v1/case-events/1').json({}),
      client.delete('/api/v1/case-events/1'),
    ])

    responses.forEach((response) => {
      response.assertStatus(401)
    })
  })

  test('should isolate case events by tenant', async ({ client, assert }) => {
    // Create two separate tenants with users
    const user1 = await UserFactory.create()
    const tenant1 = await setupTenantForUser(user1)

    const user2 = await UserFactory.create()
    const tenant2 = await setupTenantForUser(user2)

    // Create events in tenant1
    const { event1 } = await TenantContextService.run(
      { tenant_id: tenant1.id, tenant: tenant1, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user1.id,
        }).create()

        const createdEvent1 = await CaseEventFactory.merge({
          case_id: caseModel.id,
          title: 'Evento Tenant 1',
        }).create()

        return { event1: createdEvent1 }
      }
    )

    // Create events in tenant2
    await TenantContextService.run(
      { tenant_id: tenant2.id, tenant: tenant2, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user2.id,
        }).create()

        await CaseEventFactory.merge({
          case_id: caseModel.id,
          title: 'Evento Tenant 2',
        }).create()

        return {}
      }
    )

    // User1 should only see their tenant's events
    const response = await client
      .get('/api/v1/case-events')
      .header('X-Tenant-ID', tenant1.id)
      .loginAs(user1)

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.data.length, 1)
    assert.equal(body.data[0].title, 'Evento Tenant 1')

    // User1 should NOT be able to access tenant2's event
    const forbiddenResponse = await client
      .get(`/api/v1/case-events/${event1.id}`)
      .header('X-Tenant-ID', tenant2.id)
      .loginAs(user2)

    // Should return 404 because tenant scoping prevents access
    forbiddenResponse.assertStatus(404)
  })
})
