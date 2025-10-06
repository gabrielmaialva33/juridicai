import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'

import CreateDeadlineService from '#services/deadlines/create_deadline_service'
import TenantContextService from '#services/tenants/tenant_context_service'
import { TenantFactory } from '#database/factories/tenant_factory'
import { CaseFactory } from '#database/factories/case_factory'
import { UserFactory } from '#database/factories/user_factory'

test.group('CreateDeadlineService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should create deadline with valid data', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const caseRecord = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await CaseFactory.with('client').with('responsible_lawyer').create()
      }
    )
    const user = await UserFactory.create()
    const service = await app.container.make(CreateDeadlineService)

    const deadlineData = {
      case_id: caseRecord.id,
      responsible_id: user.id,
      title: 'Prazo para contestação',
      description: 'Contestar a ação judicial',
      deadline_date: '2025-12-31',
    }

    const deadline = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(deadlineData)
      }
    )

    assert.exists(deadline)
    assert.equal(deadline.case_id, caseRecord.id)
    assert.equal(deadline.responsible_id, user.id)
    assert.equal(deadline.title, 'Prazo para contestação')
    assert.equal(deadline.description, 'Contestar a ação judicial')
    assert.equal(deadline.tenant_id, tenant.id)
  })

  test('should convert deadline_date from string to DateTime', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const caseRecord = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await CaseFactory.with('client').with('responsible_lawyer').create()
      }
    )
    const user = await UserFactory.create()
    const service = await app.container.make(CreateDeadlineService)

    const deadlineData = {
      case_id: caseRecord.id,
      responsible_id: user.id,
      title: 'Test Deadline',
      deadline_date: '2025-12-31',
    }

    const deadline = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(deadlineData)
      }
    )

    assert.instanceOf(deadline.deadline_date, DateTime)
    assert.equal(deadline.deadline_date.year, 2025)
    assert.equal(deadline.deadline_date.month, 12)
    assert.equal(deadline.deadline_date.day, 31)
  })

  test('should set default status as pending', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const caseRecord = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await CaseFactory.with('client').with('responsible_lawyer').create()
      }
    )
    const user = await UserFactory.create()
    const service = await app.container.make(CreateDeadlineService)

    const deadlineData = {
      case_id: caseRecord.id,
      responsible_id: user.id,
      title: 'Test Deadline',
      deadline_date: '2025-12-31',
    }

    const deadline = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(deadlineData)
      }
    )

    assert.equal(deadline.status, 'pending')
  })

  test('should set default is_fatal as false', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const caseRecord = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await CaseFactory.with('client').with('responsible_lawyer').create()
      }
    )
    const user = await UserFactory.create()
    const service = await app.container.make(CreateDeadlineService)

    const deadlineData = {
      case_id: caseRecord.id,
      responsible_id: user.id,
      title: 'Test Deadline',
      deadline_date: '2025-12-31',
    }

    const deadline = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(deadlineData)
      }
    )

    assert.isFalse(deadline.is_fatal)
  })

  test('should create deadline with internal_deadline_date', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const caseRecord = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await CaseFactory.with('client').with('responsible_lawyer').create()
      }
    )
    const user = await UserFactory.create()
    const service = await app.container.make(CreateDeadlineService)

    const deadlineData = {
      case_id: caseRecord.id,
      responsible_id: user.id,
      title: 'Test Deadline',
      deadline_date: '2025-12-31',
      internal_deadline_date: '2025-12-25',
    }

    const deadline = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(deadlineData)
      }
    )

    assert.exists(deadline.internal_deadline_date)
    assert.instanceOf(deadline.internal_deadline_date, DateTime)
    assert.equal(deadline.internal_deadline_date.year, 2025)
    assert.equal(deadline.internal_deadline_date.month, 12)
    assert.equal(deadline.internal_deadline_date.day, 25)
  })

  test('should create deadline with alert_config', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const caseRecord = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await CaseFactory.with('client').with('responsible_lawyer').create()
      }
    )
    const user = await UserFactory.create()
    const service = await app.container.make(CreateDeadlineService)

    const alertConfig = {
      days_before: [7, 3, 1],
      email_enabled: true,
      sms_enabled: false,
      push_enabled: true,
      recipients: [user.id],
    }

    const deadlineData = {
      case_id: caseRecord.id,
      responsible_id: user.id,
      title: 'Test Deadline',
      deadline_date: '2025-12-31',
      alert_config: alertConfig,
    }

    const deadline = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(deadlineData)
      }
    )

    assert.exists(deadline.alert_config)
    assert.deepEqual(deadline.alert_config, alertConfig)
  })
})
