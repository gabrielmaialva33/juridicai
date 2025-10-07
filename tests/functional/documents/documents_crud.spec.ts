import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import Role from '#models/role'
import Document from '#models/document'

import IPermission from '#interfaces/permission_interface'
import IRole from '#interfaces/role_interface'
import { setupTenantForUser } from '#tests/utils/tenant_test_helper'
import { assignPermissions } from '#tests/utils/permission_test_helper'
import { UserFactory } from '#database/factories/user_factory'
import { ClientFactory } from '#database/factories/client_factory'
import { CaseFactory } from '#database/factories/case_factory'
import { DocumentFactory } from '#database/factories/document_factory'
import TenantContextService from '#services/tenants/tenant_context_service'
import db from '@adonisjs/lucid/services/db'

test.group('Documents CRUD', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should list documents with pagination', async ({ client, assert }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const user = await UserFactory.create()
    await db.table('user_roles').insert({
      user_id: user.id,
      role_id: userRole.id,
    })

    const tenant = await setupTenantForUser(user)
    await assignPermissions(userRole, [IPermission.Actions.READ])

    // Create test data within tenant context
    const { documents } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        const createdDocuments = await DocumentFactory.merge({
          uploaded_by: user.id,
          case_id: caseModel.id,
          client_id: clientModel.id,
        }).createMany(3)

        return { documents: createdDocuments }
      }
    )

    const response = await client
      .get('/api/v1/documents')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    assert.properties(response.body(), ['meta', 'data'])
    assert.equal(response.body().data.length, 3)
    // Verify all created documents are in the response (order may vary)
    const responseIds = response.body().data.map((doc: any) => doc.id)
    documents.forEach((doc) => {
      assert.include(responseIds, doc.id)
    })
  })

  test('should filter documents by case_id', async ({ client, assert }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const user = await UserFactory.create()
    await db.table('user_roles').insert({
      user_id: user.id,
      role_id: userRole.id,
    })

    const tenant = await setupTenantForUser(user)
    await assignPermissions(userRole, [IPermission.Actions.READ])

    const { case1 } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const createdCase1 = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()
        const case2 = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        await DocumentFactory.merge({
          uploaded_by: user.id,
          case_id: createdCase1.id,
          client_id: clientModel.id,
        }).createMany(2)

        await DocumentFactory.merge({
          uploaded_by: user.id,
          case_id: case2.id,
          client_id: clientModel.id,
        }).createMany(2)

        return { case1: createdCase1 }
      }
    )

    const response = await client
      .get(`/api/v1/documents?case_id=${case1.id}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.length, 2)
    assert.isTrue(response.body().data.every((doc: any) => doc.case_id === case1.id))
  })

  test('should filter documents by client_id', async ({ client, assert }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const user = await UserFactory.create()
    await db.table('user_roles').insert({
      user_id: user.id,
      role_id: userRole.id,
    })

    const tenant = await setupTenantForUser(user)
    await assignPermissions(userRole, [IPermission.Actions.READ])

    const { client1 } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const createdClient1 = await ClientFactory.create()
        const client2 = await ClientFactory.create()

        await DocumentFactory.merge({
          uploaded_by: user.id,
          client_id: createdClient1.id,
          case_id: null,
        }).createMany(2)

        await DocumentFactory.merge({
          uploaded_by: user.id,
          client_id: client2.id,
          case_id: null,
        }).createMany(2)

        return { client1: createdClient1 }
      }
    )

    const response = await client
      .get(`/api/v1/documents?client_id=${client1.id}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.length, 2)
    assert.isTrue(response.body().data.every((doc: any) => doc.client_id === client1.id))
  })

  test('should filter documents by document_type', async ({ client, assert }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const user = await UserFactory.create()
    await db.table('user_roles').insert({
      user_id: user.id,
      role_id: userRole.id,
    })

    const tenant = await setupTenantForUser(user)
    await assignPermissions(userRole, [IPermission.Actions.READ])

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        // Create petitions
        await DocumentFactory.merge({
          uploaded_by: user.id,
          case_id: caseModel.id,
          client_id: clientModel.id,
        })
          .apply('petition')
          .createMany(2)

        // Create contracts
        await DocumentFactory.merge({
          uploaded_by: user.id,
          case_id: caseModel.id,
          client_id: clientModel.id,
        })
          .apply('contract')
          .createMany(2)
      }
    )

    const response = await client
      .get('/api/v1/documents?document_type=petition')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.length, 2)
    assert.isTrue(response.body().data.every((doc: any) => doc.document_type === 'petition'))
  })

  test('should search documents by title or description', async ({ client, assert }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const user = await UserFactory.create()
    await db.table('user_roles').insert({
      user_id: user.id,
      role_id: userRole.id,
    })

    const tenant = await setupTenantForUser(user)
    await assignPermissions(userRole, [IPermission.Actions.READ])

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        // Create document with specific title
        await DocumentFactory.merge({
          uploaded_by: user.id,
          case_id: caseModel.id,
          client_id: clientModel.id,
          title: 'Unique Petition Document',
          description: 'This is a unique document',
        }).create()

        // Create other documents
        await DocumentFactory.merge({
          uploaded_by: user.id,
          case_id: caseModel.id,
          client_id: clientModel.id,
          title: 'Contract Agreement',
        }).createMany(2)
      }
    )

    const response = await client
      .get('/api/v1/documents?search=Unique')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.length, 1)
    assert.include(response.body().data[0].title, 'Unique')
  })

  test('should get document by id', async ({ client }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const user = await UserFactory.create()
    await db.table('user_roles').insert({
      user_id: user.id,
      role_id: userRole.id,
    })

    const tenant = await setupTenantForUser(user)
    await assignPermissions(userRole, [IPermission.Actions.READ])

    const { document } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        const createdDocument = await DocumentFactory.merge({
          uploaded_by: user.id,
          case_id: caseModel.id,
          client_id: clientModel.id,
        }).create()

        return { document: createdDocument }
      }
    )

    const response = await client
      .get(`/api/v1/documents/${document.id}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({
      id: document.id,
      title: document.title,
      document_type: document.document_type,
      file_path: document.file_path,
    })
  })

  test('should get document with case relationship preloaded', async ({ client, assert }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const user = await UserFactory.create()
    await db.table('user_roles').insert({
      user_id: user.id,
      role_id: userRole.id,
    })

    const tenant = await setupTenantForUser(user)
    await assignPermissions(userRole, [IPermission.Actions.READ])

    const { document, caseModel } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const createdCase = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        const createdDocument = await DocumentFactory.merge({
          uploaded_by: user.id,
          case_id: createdCase.id,
          client_id: clientModel.id,
        }).create()

        return { document: createdDocument, caseModel: createdCase }
      }
    )

    // NOTE: The controller currently hardcodes withCase: true, so the case
    // relationship is always loaded. If query param support is needed,
    // update the controller to read request.input('with_case')
    const response = await client
      .get(`/api/v1/documents/${document.id}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    assert.properties(response.body().case, ['id', 'case_number', 'case_type'])
    assert.equal(response.body().case.id, caseModel.id)
  })

  test('should return 404 for non-existent document', async ({ client }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const user = await UserFactory.create()
    await db.table('user_roles').insert({
      user_id: user.id,
      role_id: userRole.id,
    })

    const tenant = await setupTenantForUser(user)
    await assignPermissions(userRole, [IPermission.Actions.READ])

    const response = await client
      .get('/api/v1/documents/999999')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(404)
    response.assertBodyContains({
      message: 'Document not found',
    })
  })

  test('should create document with valid data', async ({ client, assert }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const user = await UserFactory.create()
    await db.table('user_roles').insert({
      user_id: user.id,
      role_id: userRole.id,
    })

    const tenant = await setupTenantForUser(user)
    await assignPermissions(userRole, [IPermission.Actions.CREATE])

    const { clientModel, caseModel } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const createdClient = await ClientFactory.create()
        const createdCase = await CaseFactory.merge({
          client_id: createdClient.id,
          responsible_lawyer_id: user.id,
        }).create()

        return { clientModel: createdClient, caseModel: createdCase }
      }
    )

    const documentData = {
      case_id: caseModel.id,
      client_id: clientModel.id,
      document_type: 'petition',
      title: 'Petição Inicial',
      description: 'Petição inicial do processo',
      file_path: '/storage/documents/petition-123.pdf',
      file_size: 1024000,
      mime_type: 'application/pdf',
      original_filename: 'petition-123.pdf',
      storage_provider: 'local',
      access_level: 'tenant',
      is_signed: false,
      is_ocr_processed: false,
      version: 1,
    }

    const response = await client
      .post('/api/v1/documents')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json(documentData)

    response.assertStatus(201)
    assert.equal(response.body().title, documentData.title)
    assert.equal(response.body().document_type, documentData.document_type)
    assert.equal(response.body().file_path, documentData.file_path)
    assert.equal(response.body().case_id, caseModel.id)
    assert.equal(response.body().client_id, clientModel.id)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const createdDocument = await Document.find(response.body().id)
        assert.isNotNull(createdDocument)
        assert.equal(createdDocument!.tenant_id, tenant.id)
        assert.equal(createdDocument!.uploaded_by, user.id)
      }
    )
  })

  test('should validate required fields on document creation', async ({ client, assert }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const user = await UserFactory.create()
    await db.table('user_roles').insert({
      user_id: user.id,
      role_id: userRole.id,
    })

    const tenant = await setupTenantForUser(user)
    await assignPermissions(userRole, [IPermission.Actions.CREATE])

    // Missing required fields: case_id/client_id, document_type, title, file_path
    const response = await client
      .post('/api/v1/documents')
      .header('Accept', 'application/json')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        description: 'Document without required fields',
      })

    response.assertStatus(422)
    // Check that validation errors are present for required fields
    assert.properties(response.body(), ['errors'])
    assert.isArray(response.body().errors)
    assert.isAbove(response.body().errors.length, 0)

    // Verify that at least title and document_type are validated
    const errorFields = response.body().errors.map((err: any) => err.field)
    assert.include(errorFields, 'title')
    assert.include(errorFields, 'document_type')
  })

  test('should update document', async ({ client, assert }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const user = await UserFactory.create()
    await db.table('user_roles').insert({
      user_id: user.id,
      role_id: userRole.id,
    })

    const tenant = await setupTenantForUser(user)
    await assignPermissions(userRole, [IPermission.Actions.UPDATE])

    const { document } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        const createdDocument = await DocumentFactory.merge({
          uploaded_by: user.id,
          case_id: caseModel.id,
          client_id: clientModel.id,
          title: 'Original Title',
          description: 'Original description',
        }).create()

        return { document: createdDocument }
      }
    )

    const updateData = {
      title: 'Updated Document Title',
      description: 'Updated document description',
      tags: ['updated', 'important'],
    }

    const response = await client
      .patch(`/api/v1/documents/${document.id}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json(updateData)

    response.assertStatus(200)
    response.assertBodyContains({
      id: document.id,
      title: updateData.title,
      description: updateData.description,
    })

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        await document.refresh()
        assert.equal(document.title, updateData.title)
        assert.equal(document.description, updateData.description)
        assert.deepEqual(document.tags, updateData.tags)
      }
    )
  })

  test('should delete document (hard delete)', async ({ client, assert }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const user = await UserFactory.create()
    await db.table('user_roles').insert({
      user_id: user.id,
      role_id: userRole.id,
    })

    const tenant = await setupTenantForUser(user)
    await assignPermissions(userRole, [IPermission.Actions.DELETE])

    const { document } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        const createdDocument = await DocumentFactory.merge({
          uploaded_by: user.id,
          case_id: caseModel.id,
          client_id: clientModel.id,
        }).create()

        return { document: createdDocument }
      }
    )

    const response = await client
      .delete(`/api/v1/documents/${document.id}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(204)

    // Verify hard delete (record should not exist in database)
    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const deletedDocument = await db.from('documents').where('id', document.id).first()
        assert.isNull(deletedDocument)

        // Verify not found with model query (bypass tenant scope for verification)
        const notFoundDocument = await Document.withoutTenantScope()
          .where('id', document.id)
          .first()
        assert.isNull(notFoundDocument)
      }
    )
  })

  test('should download document', async ({ client }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const user = await UserFactory.create()
    await db.table('user_roles').insert({
      user_id: user.id,
      role_id: userRole.id,
    })

    const tenant = await setupTenantForUser(user)
    await assignPermissions(userRole, [IPermission.Actions.READ])

    const { document } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        const createdDocument = await DocumentFactory.merge({
          uploaded_by: user.id,
          case_id: caseModel.id,
          client_id: clientModel.id,
          storage_provider: 's3', // Use S3 to avoid file existence check in tests
        }).create()

        return { document: createdDocument }
      }
    )

    const response = await client
      .get(`/api/v1/documents/${document.id}/download?url_only=true`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({
      url: response.body().url,
      expires_in: 3600,
    })
  })

  test('should require authentication for all operations', async ({ client }) => {
    const responses = await Promise.all([
      client.get('/api/v1/documents'),
      client.get('/api/v1/documents/1'),
      client.post('/api/v1/documents').json({}),
      client.patch('/api/v1/documents/1').json({}),
      client.delete('/api/v1/documents/1'),
      client.get('/api/v1/documents/1/download'),
    ])

    responses.forEach((response) => {
      response.assertStatus(401)
    })
  })
})
