import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'

import GetDeadlineService from '#services/deadlines/get_deadline_service'
import TenantContextService from '#services/tenants/tenant_context_service'
import { TenantFactory } from '#database/factories/tenant_factory'
import { DeadlineFactory } from '#database/factories/deadline_factory'
import { CaseFactory } from '#database/factories/case_factory'
import { UserFactory } from '#database/factories/user_factory'

test.group('GetDeadlineService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should get deadline by id', async ({ assert }) => {
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

    const service = await app.container.make(GetDeadlineService)

    const result = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(deadline.id)
      }
    )

    assert.exists(result)
    assert.equal(result!.id, deadline.id)
    assert.equal(result!.title, deadline.title)
  })

  test('should return null if deadline not found', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const service = await app.container.make(GetDeadlineService)

    const result = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(99999)
      }
    )

    assert.isNull(result)
  })

  test('should load case relationship when withCase=true', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const { deadline, caseRecord } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const createdCase = await CaseFactory.with('client').with('responsible_lawyer').create()
        const user = await UserFactory.create()
        const createdDeadline = await DeadlineFactory.merge({
          case_id: createdCase.id,
          responsible_id: user.id,
        }).create()
        return { deadline: createdDeadline, caseRecord: createdCase }
      }
    )

    const service = await app.container.make(GetDeadlineService)

    const result = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(deadline.id, { withCase: true })
      }
    )

    assert.exists(result)
    assert.exists(result!.case)
    assert.equal(result!.case.id, caseRecord.id)
  })

  test('should load responsible relationship when withResponsible=true', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const { deadline, user } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const createdUser = await UserFactory.create()
        const createdDeadline = await DeadlineFactory.merge({
          case_id: caseRecord.id,
          responsible_id: createdUser.id,
        }).create()
        return { deadline: createdDeadline, user: createdUser }
      }
    )

    const service = await app.container.make(GetDeadlineService)

    const result = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(deadline.id, { withResponsible: true })
      }
    )

    assert.exists(result)
    assert.exists(result!.responsible)
    assert.equal(result!.responsible.id, user.id)
  })

  test('should load multiple relationships', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const { deadline, caseRecord, user } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const createdCase = await CaseFactory.with('client').with('responsible_lawyer').create()
        const createdUser = await UserFactory.create()
        const createdDeadline = await DeadlineFactory.merge({
          case_id: createdCase.id,
          responsible_id: createdUser.id,
        }).create()
        return { deadline: createdDeadline, caseRecord: createdCase, user: createdUser }
      }
    )

    const service = await app.container.make(GetDeadlineService)

    const result = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(deadline.id, { withCase: true, withResponsible: true })
      }
    )

    assert.exists(result)
    assert.exists(result!.case)
    assert.equal(result!.case.id, caseRecord.id)
    assert.exists(result!.responsible)
    assert.equal(result!.responsible.id, user.id)
  })
})
