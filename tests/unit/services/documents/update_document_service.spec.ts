import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'

import UpdateDocumentService from '#services/documents/update_document_service'
import { DocumentFactory } from '#database/factories/document_factory'
import { UserFactory } from '#database/factories/user_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import TenantContextService from '#services/tenants/tenant_context_service'

test.group('UpdateDocumentService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should update document with valid data', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const user = await UserFactory.create()

    const document = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await DocumentFactory.merge({ uploaded_by: user.id }).create()
      }
    )

    const service = await app.container.make(UpdateDocumentService)
    const updated = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(document.id, {
          title: 'Updated Title',
          description: 'Updated description',
        })
      }
    )

    assert.exists(updated)
    assert.equal(updated.title, 'Updated Title')
    assert.equal(updated.description, 'Updated description')
  })

  test('should update only provided fields', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const user = await UserFactory.create()

    const document = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await DocumentFactory.merge({
          uploaded_by: user.id,
          title: 'Original Title',
          document_type: 'petition',
        }).create()
      }
    )

    const service = await app.container.make(UpdateDocumentService)
    const updated = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(document.id, {
          title: 'New Title',
        })
      }
    )

    assert.exists(updated)
    assert.equal(updated.title, 'New Title')
    assert.equal(updated.document_type, 'petition')
  })

  test('should throw error if document not found', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const service = await app.container.make(UpdateDocumentService)

    await assert.rejects(async () => {
      await TenantContextService.run(
        { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
        async () => {
          await service.run(99999, { title: 'New Title' })
        }
      )
    }, 'Document not found')
  })
})
