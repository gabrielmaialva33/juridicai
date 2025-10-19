import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'

import DeleteCaseEventService from '#services/case_events/delete_case_event_service'
import CaseEvent from '#models/case_event'
import { CaseEventFactory } from '#database/factories/case_event_factory'
import { CaseFactory } from '#database/factories/case_factory'
import { ClientFactory } from '#database/factories/client_factory'
import { UserFactory } from '#database/factories/user_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import Case from '#models/case'
import Client from '#models/client'
import User from '#models/user'
import Tenant from '#models/tenant'
import TenantContextService from '#services/tenants/tenant_context_service'

test.group('DeleteCaseEventService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should hard delete case event', async ({ assert }) => {
    const tenant = await TenantFactory.create() as Tenant
    const user = await UserFactory.create() as User

    const event = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const client = await ClientFactory.create() as Client
        const caseRecord = await CaseFactory.merge({
          client_id: client.id,
          responsible_lawyer_id: user.id,
        }).create() as Case
        return await CaseEventFactory.merge({
          case_id: caseRecord.id,
          created_by: user.id,
        }).create() as CaseEvent
      }
    )

    const service = await app.container.make(DeleteCaseEventService)
    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        await service.run(event.id)
      }
    )

    const deleted = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await CaseEvent.find(event.id)
      }
    )

    assert.isNull(deleted)
  })

  test('should throw error if event not found', async ({ assert }) => {
    const tenant = await TenantFactory.create() as Tenant

    const service = await app.container.make(DeleteCaseEventService)

    await assert.rejects(async () => {
      await TenantContextService.run(
        { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
        async () => {
          await service.run(99999)
        }
      )
    }, 'Case event not found')
  })
})
