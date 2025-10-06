import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'

import UpdateCaseEventService from '#services/case_events/update_case_event_service'
import { CaseEventFactory } from '#database/factories/case_event_factory'
import { CaseFactory } from '#database/factories/case_factory'
import { ClientFactory } from '#database/factories/client_factory'
import { UserFactory } from '#database/factories/user_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import TenantContextService from '#services/tenants/tenant_context_service'

test.group('UpdateCaseEventService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should update case event with valid data', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const user = await UserFactory.create()

    const event = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const client = await ClientFactory.create()
        const caseRecord = await CaseFactory.merge({
          client_id: client.id,
          responsible_lawyer_id: user.id,
        }).create()
        return await CaseEventFactory.merge({
          case_id: caseRecord.id,
          created_by: user.id,
        }).create()
      }
    )

    const service = await app.container.make(UpdateCaseEventService)
    const updated = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(event.id, {
          title: 'Updated Event Title',
          description: 'Updated description',
        })
      }
    )

    assert.exists(updated)
    assert.equal(updated.title, 'Updated Event Title')
    assert.equal(updated.description, 'Updated description')
  })

  test('should convert event_date to DateTime when provided', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const user = await UserFactory.create()

    const event = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const client = await ClientFactory.create()
        const caseRecord = await CaseFactory.merge({
          client_id: client.id,
          responsible_lawyer_id: user.id,
        }).create()
        return await CaseEventFactory.merge({
          case_id: caseRecord.id,
          created_by: user.id,
        }).create()
      }
    )

    const newDate = new Date('2025-12-25')
    const service = await app.container.make(UpdateCaseEventService)
    const updated = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(event.id, {
          event_date: newDate,
        })
      }
    )

    assert.exists(updated)
    assert.isTrue(DateTime.isDateTime(updated.event_date))
    assert.equal(updated.event_date.toISODate(), '2025-12-25')
  })

  test('should throw error if event not found', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const service = await app.container.make(UpdateCaseEventService)

    await assert.rejects(async () => {
      await TenantContextService.run(
        { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
        async () => {
          await service.run(99999, { title: 'New Title' })
        }
      )
    }, 'Case event not found')
  })
})
