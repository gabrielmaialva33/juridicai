import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'

import DeleteDeadlineService from '#services/deadlines/delete_deadline_service'
import TenantContextService from '#services/tenants/tenant_context_service'
import { TenantFactory } from '#database/factories/tenant_factory'
import { DeadlineFactory } from '#database/factories/deadline_factory'
import { CaseFactory } from '#database/factories/case_factory'
import { UserFactory } from '#database/factories/user_factory'
import Deadline from '#models/deadline'

test.group('DeleteDeadlineService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should cancel deadline and set status to cancelled', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const { deadline } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const user = await UserFactory.create()
        const deadline = await DeadlineFactory.merge({
          case_id: caseRecord.id,
          responsible_id: user.id,
          status: 'pending',
        }).create()
        return { deadline }
      }
    )

    const service = await app.container.make(DeleteDeadlineService)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        await service.run(deadline.id)
        // Reload the deadline to check the updated status
        await deadline.refresh()
      }
    )

    assert.equal(deadline.status, 'cancelled')
  })

  test('should not hard delete', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const { deadlineId } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const user = await UserFactory.create()
        const deadline = await DeadlineFactory.merge({
          case_id: caseRecord.id,
          responsible_id: user.id,
          status: 'pending',
        }).create()
        return { deadlineId: deadline.id }
      }
    )

    const service = await app.container.make(DeleteDeadlineService)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        await service.run(deadlineId)
      }
    )

    // Verify the deadline still exists in the database
    const stillExists = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await Deadline.find(deadlineId)
      }
    )

    assert.exists(stillExists)
    assert.equal(stillExists!.status, 'cancelled')
  })

  test('should throw error if deadline not found', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const service = await app.container.make(DeleteDeadlineService)

    await assert.rejects(async () => {
      await TenantContextService.run(
        { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
        async () => {
          await service.run(99999)
        }
      )
    }, 'Deadline not found')
  })
})
