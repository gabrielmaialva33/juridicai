import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'

import CreateDocumentService from '#services/documents/create_document_service'
import { UserFactory } from '#database/factories/user_factory'
import { CaseFactory } from '#database/factories/case_factory'
import { ClientFactory } from '#database/factories/client_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import TenantContextService from '#services/tenants/tenant_context_service'

test.group('CreateDocumentService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should create document with valid data', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const user = await UserFactory.create()

    const { client, caseRecord, document } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const createdClient = await ClientFactory.create()
        const createdCase = await CaseFactory.merge({
          client_id: createdClient.id,
          responsible_lawyer_id: user.id,
        }).create()

        const service = await app.container.make(CreateDocumentService)
        const createdDocument = await service.run(
          {
            case_id: createdCase.id,
            client_id: createdClient.id,
            title: 'Test Document',
            document_type: 'petition',
            file_path: '/uploads/test.pdf',
            file_size: 1024,
            mime_type: 'application/pdf',
            original_filename: 'test.pdf',
            storage_provider: 'local',
          },
          user.id
        )

        return { client: createdClient, caseRecord: createdCase, document: createdDocument }
      }
    )

    assert.exists(document)
    assert.equal(document.title, 'Test Document')
    assert.equal(document.document_type, 'petition')
    assert.equal(document.case_id, caseRecord.id)
    assert.equal(document.client_id, client.id)
  })

  test('should set uploaded_by from parameter', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const user = await UserFactory.create()

    const document = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const service = await app.container.make(CreateDocumentService)
        return await service.run(
          {
            title: 'Test Document',
            document_type: 'contract',
            file_path: '/uploads/test.pdf',
            file_size: 2048,
            mime_type: 'application/pdf',
            original_filename: 'contract.pdf',
            storage_provider: 'local',
          },
          user.id
        )
      }
    )

    assert.exists(document)
    assert.equal(document.uploaded_by, user.id)
  })

  test('should set default access_level as tenant', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const user = await UserFactory.create()

    const document = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const service = await app.container.make(CreateDocumentService)
        return await service.run(
          {
            title: 'Public Document',
            document_type: 'evidence',
            file_path: '/uploads/evidence.pdf',
            file_size: 512,
            mime_type: 'application/pdf',
            original_filename: 'evidence.pdf',
            storage_provider: 's3',
          },
          user.id
        )
      }
    )

    assert.exists(document)
    assert.equal(document.access_level, 'tenant')
  })

  test('should set default is_ocr_processed as false', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const user = await UserFactory.create()

    const document = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const service = await app.container.make(CreateDocumentService)
        return await service.run(
          {
            title: 'Unprocessed Document',
            document_type: 'other',
            file_path: '/uploads/doc.pdf',
            file_size: 1024,
            mime_type: 'application/pdf',
            original_filename: 'doc.pdf',
            storage_provider: 'local',
          },
          user.id
        )
      }
    )

    assert.exists(document)
    assert.isFalse(document.is_ocr_processed)
  })

  test('should set default is_signed as false', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const user = await UserFactory.create()

    const document = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const service = await app.container.make(CreateDocumentService)
        return await service.run(
          {
            title: 'Unsigned Document',
            document_type: 'report',
            file_path: '/uploads/report.pdf',
            file_size: 2048,
            mime_type: 'application/pdf',
            original_filename: 'report.pdf',
            storage_provider: 'gcs',
          },
          user.id
        )
      }
    )

    assert.exists(document)
    assert.isFalse(document.is_signed)
  })

  test('should set default version as 1', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const user = await UserFactory.create()

    const document = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const service = await app.container.make(CreateDocumentService)
        return await service.run(
          {
            title: 'Version 1 Document',
            document_type: 'judgment',
            file_path: '/uploads/judgment.pdf',
            file_size: 4096,
            mime_type: 'application/pdf',
            original_filename: 'judgment.pdf',
            storage_provider: 'local',
          },
          user.id
        )
      }
    )

    assert.exists(document)
    assert.equal(document.version, 1)
  })
})
