import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'

import GetDocumentService from '#services/documents/get_document_service'
import { DocumentFactory } from '#database/factories/document_factory'
import { UserFactory } from '#database/factories/user_factory'
import { CaseFactory } from '#database/factories/case_factory'
import { ClientFactory } from '#database/factories/client_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import TenantContextService from '#services/tenants/tenant_context_service'

test.group('GetDocumentService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should get document by id', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const user = await UserFactory.create()

    const document = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await DocumentFactory.merge({ uploaded_by: user.id }).create()
      }
    )

    const service = await app.container.make(GetDocumentService)
    const result = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await service.run(document.id)
      }
    )

    assert.exists(result)
    assert.equal(result!.id, document.id)
    assert.equal(result!.title, document.title)
  })

  test('should throw NotFoundException if document not found', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const service = await app.container.make(GetDocumentService)

    await assert.rejects(async () => {
      await TenantContextService.run(
        { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
        async () => {
          return await service.run(99999)
        }
      )
    }, 'Document not found')
  })

  test('should load case relationship when withCase=true', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const user = await UserFactory.create()

    const { caseRecord, document } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const client = await ClientFactory.create()
        const createdCase = await CaseFactory.merge({
          client_id: client.id,
          responsible_lawyer_id: user.id,
        }).create()
        const createdDocument = await DocumentFactory.merge({
          case_id: createdCase.id,
          uploaded_by: user.id,
        }).create()
        return { caseRecord: createdCase, document: createdDocument }
      }
    )

    const service = await app.container.make(GetDocumentService)
    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const result = await service.run(document.id, { withCase: true })
        assert.exists(result)
        assert.exists((result as any).case)
        assert.equal((result as any).case.id, caseRecord.id)
      }
    )
  })

  test('should load client relationship when withClient=true', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const user = await UserFactory.create()

    const { client, document } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const createdClient = await ClientFactory.create()
        const createdDocument = await DocumentFactory.merge({
          client_id: createdClient.id,
          uploaded_by: user.id,
        }).create()
        return { client: createdClient, document: createdDocument }
      }
    )

    const service = await app.container.make(GetDocumentService)
    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const result = await service.run(document.id, { withClient: true })
        assert.exists(result)
        assert.exists((result as any).client)
        assert.equal((result as any).client.id, client.id)
      }
    )
  })
})
