import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'

import CreateCaseEventService from '#services/case_events/create_case_event_service'
import { CaseFactory } from '#database/factories/case_factory'
import { ClientFactory } from '#database/factories/client_factory'
import { UserFactory } from '#database/factories/user_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import Case from '#models/case'
import Client from '#models/client'
import User from '#models/user'
import Tenant from '#models/tenant'
import TenantContextService from '#services/tenants/tenant_context_service'

test.group('CreateCaseEventService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should create case event with valid data', async ({ assert }) => {
    const tenant = (await TenantFactory.create()) as Tenant
    const user = (await UserFactory.create()) as User

    const event = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const client = (await ClientFactory.create()) as Client
        const caseRecord = (await CaseFactory.merge({
          client_id: client.id,
          responsible_lawyer_id: user.id,
        }).create()) as Case

        const service = await app.container.make(CreateCaseEventService)
        return await service.run(
          {
            case_id: caseRecord.id,
            event_type: 'hearing',
            title: 'Test Hearing',
            description: 'Test hearing description',
            event_date: new Date('2025-10-15'),
          },
          user.id
        )
      }
    )

    assert.exists(event)
    assert.equal(event.title, 'Test Hearing')
    assert.equal(event.event_type, 'hearing')
  })

  test('should convert event_date from string to DateTime', async ({ assert }) => {
    const tenant = (await TenantFactory.create()) as Tenant
    const user = (await UserFactory.create()) as User

    const event = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const client = (await ClientFactory.create()) as Client
        const caseRecord = (await CaseFactory.merge({
          client_id: client.id,
          responsible_lawyer_id: user.id,
        }).create()) as Case

        const service = await app.container.make(CreateCaseEventService)
        return await service.run(
          {
            case_id: caseRecord.id,
            event_type: 'decision',
            title: 'Decision Event',
            event_date: new Date('2025-11-20'),
          },
          user.id
        )
      }
    )

    assert.exists(event)
    assert.isTrue(DateTime.isDateTime(event.event_date))
    assert.equal(event.event_date.toISODate(), '2025-11-20')
  })

  test('should set created_by from parameter', async ({ assert }) => {
    const tenant = (await TenantFactory.create()) as Tenant
    const user = (await UserFactory.create()) as User

    const event = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const client = (await ClientFactory.create()) as Client
        const caseRecord = (await CaseFactory.merge({
          client_id: client.id,
          responsible_lawyer_id: user.id,
        }).create()) as Case

        const service = await app.container.make(CreateCaseEventService)
        return await service.run(
          {
            case_id: caseRecord.id,
            event_type: 'filing',
            title: 'Filing Event',
            event_date: new Date(),
          },
          user.id
        )
      }
    )

    assert.exists(event)
    assert.equal(event.created_by, user.id)
  })

  test('should set default source as manual', async ({ assert }) => {
    const tenant = (await TenantFactory.create()) as Tenant
    const user = (await UserFactory.create()) as User

    const event = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const client = (await ClientFactory.create()) as Client
        const caseRecord = (await CaseFactory.merge({
          client_id: client.id,
          responsible_lawyer_id: user.id,
        }).create()) as Case

        const service = await app.container.make(CreateCaseEventService)
        return await service.run(
          {
            case_id: caseRecord.id,
            event_type: 'publication',
            title: 'Publication Event',
            event_date: new Date(),
          },
          user.id
        )
      }
    )

    assert.exists(event)
    assert.equal(event.source, 'manual')
  })

  test('should create event with metadata', async ({ assert }) => {
    const tenant = (await TenantFactory.create()) as Tenant
    const user = (await UserFactory.create()) as User

    const metadata = {
      location: 'Fórum Central',
      judge: 'Dr. João Silva',
      room: '101',
    }

    const event = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const client = (await ClientFactory.create()) as Client
        const caseRecord = (await CaseFactory.merge({
          client_id: client.id,
          responsible_lawyer_id: user.id,
        }).create()) as Case

        const service = await app.container.make(CreateCaseEventService)
        return await service.run(
          {
            case_id: caseRecord.id,
            event_type: 'hearing',
            title: 'Hearing with Metadata',
            event_date: new Date(),
            metadata,
          },
          user.id
        )
      }
    )

    assert.exists(event)
    assert.deepEqual(event.metadata, metadata)
  })
})
