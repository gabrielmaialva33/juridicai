import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'

import UpdateCaseService from '#services/cases/update_case_service'
import { TenantFactory } from '#database/factories/tenant_factory'
import { CaseFactory } from '#database/factories/case_factory'
import { UserFactory } from '#database/factories/user_factory'
import TenantContextService from '#services/tenants/tenant_context_service'

test.group('UpdateCaseService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should update case with valid data', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client')
          .with('responsible_lawyer')
          .merge({
            description: 'Original description',
            priority: 'low',
          })
          .create()

        const service = await app.container.make(UpdateCaseService)

        const updateData = {
          description: 'Updated description',
          priority: 'high' as const,
        }

        return await service.run(caseRecord.id, updateData)
      }
    )

    assert.equal(result.description, 'Updated description')
    assert.equal(result.priority, 'high')
  })

  test('should update only provided fields (partial update)', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client')
          .with('responsible_lawyer')
          .merge({
            description: 'Original description',
            priority: 'medium',
            court: 'Original Court',
          })
          .create()

        const service = await app.container.make(UpdateCaseService)

        const updateData = {
          description: 'Only description updated',
        }

        return await service.run(caseRecord.id, updateData)
      }
    )

    assert.equal(result.description, 'Only description updated')
    assert.equal(result.priority, 'medium')
    assert.equal(result.court, 'Original Court')
  })

  test('should convert filed_at and closed_at to DateTime', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()

        const service = await app.container.make(UpdateCaseService)

        const updateData = {
          filed_at: '2024-01-10',
          closed_at: '2024-06-15',
        }

        return await service.run(caseRecord.id, updateData)
      }
    )

    assert.isTrue(DateTime.isDateTime(result.filed_at))
    assert.equal(result.filed_at!.toISODate(), '2024-01-10')
    assert.isTrue(DateTime.isDateTime(result.closed_at))
    assert.equal(result.closed_at!.toISODate(), '2024-06-15')
  })

  test('should update status', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client')
          .with('responsible_lawyer')
          .apply('active')
          .create()

        const service = await app.container.make(UpdateCaseService)

        const updateData = {
          status: 'closed' as const,
          closed_at: DateTime.now().toISODate(),
        }

        return await service.run(caseRecord.id, updateData)
      }
    )

    assert.equal(result.status, 'closed')
    assert.exists(result.closed_at)
  })

  test('should throw error if case not found', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    await assert.rejects(async () => {
      await TenantContextService.run(
        { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
        async () => {
          const service = await app.container.make(UpdateCaseService)

          const updateData = {
            description: 'This will fail',
          }

          await service.run(99999, updateData)
        }
      )
    }, 'Case not found')
  })

  test('should update responsible_lawyer_id', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const newLawyer = await UserFactory.create()

        const service = await app.container.make(UpdateCaseService)

        const updateData = {
          responsible_lawyer_id: newLawyer.id,
        }

        return await service.run(caseRecord.id, updateData)
      }
    )

    assert.exists(result.responsible_lawyer_id)
  })

  test('should update court and court_instance', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()

        const service = await app.container.make(UpdateCaseService)

        const updateData = {
          court: 'Superior Tribunal de Justiça - STJ',
          court_instance: 'Superior' as const,
        }

        return await service.run(caseRecord.id, updateData)
      }
    )

    assert.equal(result.court, 'Superior Tribunal de Justiça - STJ')
    assert.equal(result.court_instance, 'Superior')
  })

  test('should update tags and parties', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()

        const service = await app.container.make(UpdateCaseService)

        const updateData = {
          tags: ['novo', 'atualizado'],
          parties: {
            plaintiffs: [
              {
                name: 'Updated Author',
                role: 'Autor',
              },
            ],
          },
        }

        return await service.run(caseRecord.id, updateData)
      }
    )

    assert.deepEqual(result.tags, ['novo', 'atualizado'])
    assert.equal(result.parties!.plaintiffs?.[0]?.name, 'Updated Author')
  })
})
