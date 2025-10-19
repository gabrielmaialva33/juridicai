import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'

import GetCaseEventService from '#services/case_events/get_case_event_service'
import { CaseEventFactory } from '#database/factories/case_event_factory'
import { CaseFactory } from '#database/factories/case_factory'
import { ClientFactory } from '#database/factories/client_factory'
import { UserFactory } from '#database/factories/user_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import CaseEvent from '#models/case_event'
import Case from '#models/case'
import Client from '#models/client'
import User from '#models/user'
import Tenant from '#models/tenant'
import TenantContextService from '#services/tenants/tenant_context_service'

test.group('GetCaseEventService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should get case event by id', async ({ assert }) => {
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
        return (await CaseEventFactory.merge({
          case_id: caseRecord.id,
          created_by: user.id,
        }).create()) as CaseEvent
      }
    )

    const service = await app.container.make(GetCaseEventService)
    const result = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(event.id)
      }
    )

    assert.exists(result)
    assert.equal(result!.id, event.id)
    assert.equal(result!.title, event.title)
  })

  test('should throw NotFoundException if event not found', async ({ assert }) => {
    const tenant = (await TenantFactory.create()) as Tenant
    const service = await app.container.make(GetCaseEventService)

    await assert.rejects(async () => {
      await TenantContextService.run(
        { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
        async () => {
          return await service.run(99999)
        }
      )
    }, 'Case event not found')
  })

  test('should load case relationship when withCase=true', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const user = await UserFactory.create()

    const { caseRecord, event } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const client = await ClientFactory.create()
        const createdCase = await CaseFactory.merge({
          client_id: client.id,
          responsible_lawyer_id: user.id,
        }).create()
        const createdEvent = await CaseEventFactory.merge({
          case_id: createdCase.id,
          created_by: user.id,
        }).create()
        return { caseRecord: createdCase, event: createdEvent }
      }
    )

    const service = await app.container.make(GetCaseEventService)
    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const result = await service.run(event.id, { withCase: true })
        assert.exists(result)
        assert.exists(result.case)
        assert.equal(result.case.id, caseRecord.id)
      }
    )
  })
})
