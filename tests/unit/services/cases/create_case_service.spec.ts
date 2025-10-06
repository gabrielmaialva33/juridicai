import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'

import CreateCaseService from '#services/cases/create_case_service'
import { TenantFactory } from '#database/factories/tenant_factory'
import { ClientFactory } from '#database/factories/client_factory'
import { UserFactory } from '#database/factories/user_factory'
import TenantContextService from '#services/tenants/tenant_context_service'

test.group('CreateCaseService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should create case with valid data', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const client = await ClientFactory.create()
        const lawyer = await UserFactory.create()
        const service = await app.container.make(CreateCaseService)

        const payload = {
          client_id: client.id,
          responsible_lawyer_id: lawyer.id,
          case_type: 'civil' as const,
          description: 'Test case',
          priority: 'medium' as const,
        }

        return await service.run(payload)
      }
    )

    assert.exists(result)
    assert.equal(result.case_type, 'civil')
    assert.equal(result.description, 'Test case')
    assert.equal(result.tenant_id, tenant.id)
  })

  test('should create case with filed_at date', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const client = await ClientFactory.create()
        const lawyer = await UserFactory.create()
        const service = await app.container.make(CreateCaseService)

        const filedDate = '2024-01-15'

        const payload = {
          client_id: client.id,
          responsible_lawyer_id: lawyer.id,
          case_type: 'labor' as const,
          filed_at: filedDate,
        }

        return await service.run(payload)
      }
    )

    assert.exists(result.filed_at)
    assert.isTrue(DateTime.isDateTime(result.filed_at))
    assert.equal(result.filed_at!.toISODate(), '2024-01-15')
  })

  test('should create case with optional fields (court, tags, parties)', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const client = await ClientFactory.create()
        const lawyer = await UserFactory.create()
        const service = await app.container.make(CreateCaseService)

        const payload = {
          client_id: client.id,
          responsible_lawyer_id: lawyer.id,
          case_type: 'civil' as const,
          court: 'Tribunal de Justiça de São Paulo - TJ-SP',
          tags: ['urgente', 'trabalhista'],
          parties: {
            autor: {
              name: 'João Silva',
            },
            reu: {
              name: 'Empresa LTDA',
            },
          },
        }

        return await service.run(payload)
      }
    )

    assert.equal(result.court, 'Tribunal de Justiça de São Paulo - TJ-SP')
    assert.deepEqual(result.tags, ['urgente', 'trabalhista'])
    assert.exists(result.parties)
    assert.equal((result.parties as any).autor?.name, 'João Silva')
  })

  test('should set default status as active', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const client = await ClientFactory.create()
        const lawyer = await UserFactory.create()
        const service = await app.container.make(CreateCaseService)

        const payload = {
          client_id: client.id,
          responsible_lawyer_id: lawyer.id,
          case_type: 'civil' as const,
        }

        return await service.run(payload)
      }
    )

    assert.equal(result.status, 'active')
  })

  test('should convert filed_at from string to DateTime', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const client = await ClientFactory.create()
        const lawyer = await UserFactory.create()
        const service = await app.container.make(CreateCaseService)

        const payload = {
          client_id: client.id,
          responsible_lawyer_id: lawyer.id,
          case_type: 'family' as const,
          filed_at: '2024-03-20',
        }

        return await service.run(payload)
      }
    )

    assert.isTrue(DateTime.isDateTime(result.filed_at))
  })

  test('should throw error if client not found', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const lawyer = await UserFactory.create()
        const service = await app.container.make(CreateCaseService)

        const payload = {
          client_id: 99999,
          responsible_lawyer_id: lawyer.id,
          case_type: 'civil' as const,
        }

        await assert.rejects(async () => {
          await service.run(payload)
        })
      }
    )
  })

  test('should throw error if responsible_lawyer not found', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const client = await ClientFactory.create()
        const service = await app.container.make(CreateCaseService)

        const payload = {
          client_id: client.id,
          responsible_lawyer_id: 99999,
          case_type: 'civil' as const,
        }

        await assert.rejects(async () => {
          await service.run(payload)
        })
      }
    )
  })
})
