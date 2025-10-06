import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'

import DeleteCaseService from '#services/cases/delete_case_service'
import { TenantFactory } from '#database/factories/tenant_factory'
import { CaseFactory } from '#database/factories/case_factory'
import TenantContextService from '#services/tenants/tenant_context_service'
import Case from '#models/case'

test.group('DeleteCaseService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should archive case (set status to archived)', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client')
          .with('responsible_lawyer')
          .apply('active')
          .create()
        const service = await app.container.make(DeleteCaseService)

        await service.run(caseRecord.id)

        await caseRecord.refresh()
        assert.equal(caseRecord.status, 'archived')
      }
    )
  })

  test('should not hard delete, only change status', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const caseId = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client')
          .with('responsible_lawyer')
          .apply('active')
          .create()
        const service = await app.container.make(DeleteCaseService)

        await service.run(caseRecord.id)

        return caseRecord.id
      }
    )

    // Verify the case still exists in database
    const stillExists = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const found = await Case.query().where('id', caseId).first()
        return found
      }
    )

    assert.exists(stillExists)
    assert.equal(stillExists!.status, 'archived')
  })

  test('should throw error if case not found', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    await assert.rejects(async () => {
      await TenantContextService.run(
        { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
        async () => {
          const service = await app.container.make(DeleteCaseService)
          await service.run(99999)
        }
      )
    }, 'Case not found')
  })

  test('should archive already closed case', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client')
          .with('responsible_lawyer')
          .apply('closed')
          .create()
        const service = await app.container.make(DeleteCaseService)

        await service.run(caseRecord.id)

        await caseRecord.refresh()
        assert.equal(caseRecord.status, 'archived')
      }
    )
  })

  test('should preserve case data when archiving', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client')
          .with('responsible_lawyer')
          .merge({
            description: 'Important case',
            priority: 'high',
            tags: ['important', 'test'],
          })
          .create()

        const originalDescription = caseRecord.description
        const originalPriority = caseRecord.priority
        const originalTags = caseRecord.tags

        const service = await app.container.make(DeleteCaseService)
        await service.run(caseRecord.id)

        await caseRecord.refresh()

        assert.equal(caseRecord.status, 'archived')
        assert.equal(caseRecord.description, originalDescription)
        assert.equal(caseRecord.priority, originalPriority)
        assert.deepEqual(caseRecord.tags, originalTags)
      }
    )
  })
})
