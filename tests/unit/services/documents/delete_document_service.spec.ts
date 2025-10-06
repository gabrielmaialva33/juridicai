import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'

import DeleteDocumentService from '#services/documents/delete_document_service'
import Document from '#models/document'
import { DocumentFactory } from '#database/factories/document_factory'
import { UserFactory } from '#database/factories/user_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import TenantContextService from '#services/tenants/tenant_context_service'

test.group('DeleteDocumentService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should hard delete document', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const user = await UserFactory.create()

    const document = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await DocumentFactory.merge({ uploaded_by: user.id }).create()
      }
    )

    const service = await app.container.make(DeleteDocumentService)
    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        await service.run(document.id)
      }
    )

    const deleted = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await Document.find(document.id)
      }
    )

    assert.isNull(deleted)
  })

  test('should throw error if document not found', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const service = await app.container.make(DeleteDocumentService)

    await assert.rejects(async () => {
      await TenantContextService.run(
        { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
        async () => {
          await service.run(99999)
        }
      )
    }, 'Document not found')
  })
})
