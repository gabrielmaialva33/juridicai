import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'

import GetCaseService from '#services/cases/get_case_service'
import { TenantFactory } from '#database/factories/tenant_factory'
import { CaseFactory } from '#database/factories/case_factory'
import { DeadlineFactory } from '#database/factories/deadline_factory'
import { DocumentFactory } from '#database/factories/document_factory'
import { UserFactory } from '#database/factories/user_factory'
import TenantContextService from '#services/tenants/tenant_context_service'

test.group('GetCaseService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should get case by id', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const service = await app.container.make(GetCaseService)

        return await service.run(caseRecord.id)
      }
    )

    assert.exists(result)
    assert.equal(result?.tenant_id, tenant.id)
  })

  test('should return null if case not found', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const service = await app.container.make(GetCaseService)
        return await service.run(99999)
      }
    )

    assert.isNull(result)
  })

  test('should load client relationship when withClient=true', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const service = await app.container.make(GetCaseService)

        const result = await service.run(caseRecord.id, { withClient: true })
        assert.exists(result)
        assert.exists(result!.client)
        assert.equal(result!.client.id, result!.client_id)
      }
    )
  })

  test('should load deadlines relationship when withDeadlines=true', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const user = await UserFactory.create()

        // Create some deadlines for this case
        await DeadlineFactory.merge({
          case_id: caseRecord.id,
          responsible_id: user.id,
        }).createMany(3)

        const service = await app.container.make(GetCaseService)
        const result = await service.run(caseRecord.id, { withDeadlines: true })
        assert.exists(result)
        assert.isArray(result!.deadlines)
        assert.lengthOf(result!.deadlines, 3)
      }
    )
  })

  test('should load documents relationship when withDocuments=true', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const user = await UserFactory.create()

        // Create some documents for this case
        await DocumentFactory.merge({
          case_id: caseRecord.id,
          uploaded_by: user.id,
        }).createMany(2)

        const service = await app.container.make(GetCaseService)
        const result = await service.run(caseRecord.id, { withDocuments: true })
        assert.exists(result)
        assert.isArray(result!.documents)
        assert.lengthOf(result!.documents, 2)
      }
    )
  })

  test('should load multiple relationships', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const user = await UserFactory.create()

        // Create related data
        await DeadlineFactory.merge({
          case_id: caseRecord.id,
          responsible_id: user.id,
        }).createMany(2)
        await DocumentFactory.merge({
          case_id: caseRecord.id,
          uploaded_by: user.id,
        }).createMany(1)

        const service = await app.container.make(GetCaseService)
        const result = await service.run(caseRecord.id, {
          withClient: true,
          withDeadlines: true,
          withDocuments: true,
        })

        assert.exists(result)
        assert.exists(result!.client)
        assert.isArray(result!.deadlines)
        assert.lengthOf(result!.deadlines, 2)
        assert.isArray(result!.documents)
        assert.lengthOf(result!.documents, 1)
      }
    )
  })
})
