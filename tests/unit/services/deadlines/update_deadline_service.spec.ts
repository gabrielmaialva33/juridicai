import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'

import UpdateDeadlineService from '#services/deadlines/update_deadline_service'
import TenantContextService from '#services/tenants/tenant_context_service'
import { TenantFactory } from '#database/factories/tenant_factory'
import { DeadlineFactory } from '#database/factories/deadline_factory'
import { CaseFactory } from '#database/factories/case_factory'
import { UserFactory } from '#database/factories/user_factory'

test.group('UpdateDeadlineService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should update deadline with valid data', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const { deadline } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const user = await UserFactory.create()
        const createdDeadline = await DeadlineFactory.merge({
          case_id: caseRecord.id,
          responsible_id: user.id,
          title: 'Original Title',
        }).create()
        return { deadline: createdDeadline }
      }
    )

    const service = await app.container.make(UpdateDeadlineService)

    const updateData = {
      title: 'Updated Title',
      description: 'Updated description',
    }

    const updated = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(deadline.id, updateData)
      }
    )

    assert.equal(updated.title, 'Updated Title')
    assert.equal(updated.description, 'Updated description')
  })

  test('should update only provided fields', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const { deadline, originalDescription } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const user = await UserFactory.create()
        const createdDeadline = await DeadlineFactory.merge({
          case_id: caseRecord.id,
          responsible_id: user.id,
          title: 'Original Title',
          description: 'Original description',
        }).create()
        return { deadline: createdDeadline, originalDescription: createdDeadline.description }
      }
    )

    const service = await app.container.make(UpdateDeadlineService)

    const updateData = {
      title: 'Updated Title',
    }

    const updated = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(deadline.id, updateData)
      }
    )

    assert.equal(updated.title, 'Updated Title')
    assert.equal(updated.description, originalDescription)
  })

  test('should convert deadline_date to DateTime', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const { deadline } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const user = await UserFactory.create()
        const createdDeadline = await DeadlineFactory.merge({
          case_id: caseRecord.id,
          responsible_id: user.id,
        }).create()
        return { deadline: createdDeadline }
      }
    )

    const service = await app.container.make(UpdateDeadlineService)

    const updateData = {
      deadline_date: '2026-06-15',
    }

    const updated = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(deadline.id, updateData)
      }
    )

    assert.ok(updated.deadline_date instanceof DateTime)
    assert.equal(updated.deadline_date.year, 2026)
    assert.equal(updated.deadline_date.month, 6)
    assert.equal(updated.deadline_date.day, 15)
  })

  test('should update status', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const { deadline } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const user = await UserFactory.create()
        const createdDeadline = await DeadlineFactory.merge({
          case_id: caseRecord.id,
          responsible_id: user.id,
          status: 'pending',
        }).create()
        return { deadline: createdDeadline }
      }
    )

    const service = await app.container.make(UpdateDeadlineService)

    const updateData = {
      status: 'completed' as const,
    }

    const updated = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(deadline.id, updateData)
      }
    )

    assert.equal(updated.status, 'completed')
  })

  test('should throw error if deadline not found', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const service = await app.container.make(UpdateDeadlineService)

    const updateData = {
      title: 'Updated Title',
    }

    await assert.rejects(async () => {
      await TenantContextService.run(
        { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
        async () => {
          return await service.run(99999, updateData)
        }
      )
    }, 'Deadline not found')
  })
})
