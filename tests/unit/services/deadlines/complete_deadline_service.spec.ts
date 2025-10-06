import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'

import CompleteDeadlineService from '#services/deadlines/complete_deadline_service'
import TenantContextService from '#services/tenants/tenant_context_service'
import { TenantFactory } from '#database/factories/tenant_factory'
import { DeadlineFactory } from '#database/factories/deadline_factory'
import { CaseFactory } from '#database/factories/case_factory'
import { UserFactory } from '#database/factories/user_factory'

test.group('CompleteDeadlineService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should complete deadline and set completed fields', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const { deadline, user } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const createdUser = await UserFactory.create()
        const createdDeadline = await DeadlineFactory.merge({
          case_id: caseRecord.id,
          responsible_id: createdUser.id,
          status: 'pending',
        }).create()
        return { deadline: createdDeadline, user: createdUser }
      }
    )

    const service = await app.container.make(CompleteDeadlineService)

    const completed = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(deadline.id, user.id)
      }
    )

    assert.equal(completed.status, 'completed')
    assert.exists(completed.completed_at)
    assert.equal(completed.completed_by, user.id)
  })

  test('should set status to completed', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const { deadline, user } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const createdUser = await UserFactory.create()
        const createdDeadline = await DeadlineFactory.merge({
          case_id: caseRecord.id,
          responsible_id: createdUser.id,
          status: 'pending',
        }).create()
        return { deadline: createdDeadline, user: createdUser }
      }
    )

    const service = await app.container.make(CompleteDeadlineService)

    const completed = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(deadline.id, user.id)
      }
    )

    assert.equal(completed.status, 'completed')
  })

  test('should set completed_at to current DateTime', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const { deadline, user } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const createdUser = await UserFactory.create()
        const createdDeadline = await DeadlineFactory.merge({
          case_id: caseRecord.id,
          responsible_id: createdUser.id,
          status: 'pending',
        }).create()
        return { deadline: createdDeadline, user: createdUser }
      }
    )

    const service = await app.container.make(CompleteDeadlineService)
    const beforeCompletion = DateTime.now()

    const completed = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(deadline.id, user.id)
      }
    )

    const afterCompletion = DateTime.now()

    assert.exists(completed.completed_at)
    assert.isTrue(DateTime.isDateTime(completed.completed_at))
    assert.isTrue(completed.completed_at! >= beforeCompletion)
    assert.isTrue(completed.completed_at! <= afterCompletion)
  })

  test('should set completed_by from parameter', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const { deadline, completingUser } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const createdUser = await UserFactory.create()
        const createdCompletingUser = await UserFactory.create()
        const createdDeadline = await DeadlineFactory.merge({
          case_id: caseRecord.id,
          responsible_id: createdUser.id,
          status: 'pending',
        }).create()
        return {
          deadline: createdDeadline,
          user: createdUser,
          completingUser: createdCompletingUser,
        }
      }
    )

    const service = await app.container.make(CompleteDeadlineService)

    const completed = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(deadline.id, completingUser.id)
      }
    )

    assert.equal(completed.completed_by, completingUser.id)
  })

  test('should set completion_notes when provided', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const { deadline, user } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const createdUser = await UserFactory.create()
        const createdDeadline = await DeadlineFactory.merge({
          case_id: caseRecord.id,
          responsible_id: createdUser.id,
          status: 'pending',
        }).create()
        return { deadline: createdDeadline, user: createdUser }
      }
    )

    const service = await app.container.make(CompleteDeadlineService)
    const notes = 'Prazo cumprido com sucesso. Documentos protocolados.'

    const completed = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(deadline.id, user.id, notes)
      }
    )

    assert.equal(completed.completion_notes, notes)
  })

  test('should throw error if deadline not found', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const user = await UserFactory.create()
    const service = await app.container.make(CompleteDeadlineService)

    await assert.rejects(async () => {
      await TenantContextService.run(
        { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
        async () => {
          return await service.run(99999, user.id)
        }
      )
    }, 'Deadline not found')
  })
})
