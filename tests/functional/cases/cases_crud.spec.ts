import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { UserFactory } from '#database/factories/user_factory'
import { ClientFactory } from '#database/factories/client_factory'
import { CaseFactory } from '#database/factories/case_factory'
import { setupTenantForUser } from '#tests/utils/tenant_test_helper'
import TenantContextService from '#services/tenants/tenant_context_service'
import { TenantUserRole } from '#models/tenant_user'

test.group('Cases CRUD', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should list cases with pagination', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const lawyer = await UserFactory.create()
    await setupTenantForUser(lawyer, TenantUserRole.LAWYER, tenant)

    // Create some cases
    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientRecord = await ClientFactory.create()
        await CaseFactory.merge({
          status: 'active',
          client_id: clientRecord.id,
          responsible_lawyer_id: lawyer.id,
        }).createMany(3)
      }
    )

    const response = await client
      .get('/api/v1/cases')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.property(body, 'data')
    assert.property(body, 'meta')
    assert.isArray(body.data)
    assert.isAtLeast(body.data.length, 3)
  })

  test('should search cases by case_number or description', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const lawyer = await UserFactory.create()
    await setupTenantForUser(lawyer, TenantUserRole.LAWYER, tenant)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientRecord = await ClientFactory.create()

        await CaseFactory.merge({
          case_number: '1234567-89.2024.8.26.0100',
          description: 'Special case about contract disputes',
          client_id: clientRecord.id,
          responsible_lawyer_id: lawyer.id,
        }).create()

        await CaseFactory.merge({
          case_number: '9876543-21.2024.8.26.0200',
          description: 'Another regular case',
          client_id: clientRecord.id,
          responsible_lawyer_id: lawyer.id,
        }).create()
      }
    )

    // Search by case number
    const response1 = await client
      .get('/api/v1/cases?search=1234567')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response1.assertStatus(200)
    const body1 = response1.body()
    assert.isAtLeast(body1.data.length, 1)
    assert.include(body1.data[0].case_number, '1234567')

    // Search by description
    const response2 = await client
      .get('/api/v1/cases?search=contract')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response2.assertStatus(200)
    const body2 = response2.body()
    assert.isAtLeast(body2.data.length, 1)
  })

  test('should filter cases by client_id', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const lawyer = await UserFactory.create()
    await setupTenantForUser(lawyer, TenantUserRole.LAWYER, tenant)

    let targetClientId!: number

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const client1 = await ClientFactory.create()
        const client2 = await ClientFactory.create()

        targetClientId = client1.id

        await CaseFactory.merge({
          client_id: client1.id,
          responsible_lawyer_id: lawyer.id,
        }).create()
        await CaseFactory.merge({
          client_id: client2.id,
          responsible_lawyer_id: lawyer.id,
        }).create()
      }
    )

    const response = await client
      .get(`/api/v1/cases?client_id=${targetClientId}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.isAtLeast(body.data.length, 1)
    body.data.forEach((caseItem: any) => {
      assert.equal(caseItem.client_id, targetClientId)
    })
  })

  test('should filter cases by status', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const lawyer = await UserFactory.create()
    await setupTenantForUser(lawyer, TenantUserRole.LAWYER, tenant)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientRecord = await ClientFactory.create()

        await CaseFactory.merge({
          status: 'active',
          client_id: clientRecord.id,
          responsible_lawyer_id: lawyer.id,
        }).createMany(2)
        await CaseFactory.merge({
          status: 'closed',
          client_id: clientRecord.id,
          responsible_lawyer_id: lawyer.id,
        }).create()
        await CaseFactory.merge({
          status: 'archived',
          client_id: clientRecord.id,
          responsible_lawyer_id: lawyer.id,
        }).create()
      }
    )

    const response = await client
      .get('/api/v1/cases?status=active')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.isAtLeast(body.data.length, 2)
    body.data.forEach((caseItem: any) => {
      assert.equal(caseItem.status, 'active')
    })
  })

  test('should get case by ID', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    let caseId!: number

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client')
          .with('responsible_lawyer')
          .merge({
            case_number: '1234567-89.2024.8.26.0100',
            status: 'active',
          })
          .create()
        caseId = caseRecord.id
      }
    )

    const response = await client
      .get(`/api/v1/cases/${caseId}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({
      id: caseId,
      case_number: '1234567-89.2024.8.26.0100',
      status: 'active',
    })
  })

  test('should get case with client relationship', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    let caseId!: number

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        caseId = caseRecord.id
      }
    )

    const response = await client
      .get(`/api/v1/cases/${caseId}?with_client=true`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.property(body, 'client')
    assert.isObject(body.client)
    assert.property(body.client, 'id')
    assert.property(body.client, 'full_name')
  })

  test('should create case with valid data', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    let clientId!: number
    let lawyerId!: number

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientRecord = await ClientFactory.create()
        clientId = clientRecord.id
      }
    )

    const lawyer = await UserFactory.create()
    await setupTenantForUser(lawyer, TenantUserRole.LAWYER, tenant)
    lawyerId = lawyer.id

    const response = await client
      .post('/api/v1/cases')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        client_id: clientId,
        responsible_lawyer_id: lawyerId,
        case_type: 'civil',
        status: 'active',
        priority: 'medium',
        description: 'Test case description',
      })

    response.assertStatus(201)
    assert.equal(response.body().client_id, clientId)
    assert.equal(response.body().responsible_lawyer_id, lawyerId)
    assert.equal(response.body().case_type, 'civil')
    assert.equal(response.body().status, 'active')
    assert.equal(response.body().priority, 'medium')
  })

  test('should validate required fields on create', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const response = await client
      .post('/api/v1/cases')
      .header('Accept', 'application/json')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        case_type: 'civil',
        status: 'active',
        // Missing client_id and responsible_lawyer_id
      })

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'client_id',
          rule: 'required',
        },
        {
          field: 'responsible_lawyer_id',
          rule: 'required',
        },
      ],
    })
  })

  test('should fail when creating case with invalid client_id', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const lawyer = await UserFactory.create()
    await setupTenantForUser(lawyer, TenantUserRole.LAWYER, tenant)

    const response = await client
      .post('/api/v1/cases')
      .header('Accept', 'application/json')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        client_id: 999999, // Non-existent client
        responsible_lawyer_id: lawyer.id,
        case_type: 'civil',
        status: 'active',
        priority: 'medium',
      })

    // Should fail with an error (either 404 or 422 depending on implementation)
    response.assertStatus(404)
  })

  test('should update case', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    let caseId!: number

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client')
          .with('responsible_lawyer')
          .merge({
            description: 'Original description',
            priority: 'low',
          })
          .create()
        caseId = caseRecord.id
      }
    )

    const response = await client
      .patch(`/api/v1/cases/${caseId}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        description: 'Updated description',
        priority: 'high',
      })

    response.assertStatus(200)
    response.assertBodyContains({
      id: caseId,
      description: 'Updated description',
      priority: 'high',
    })
  })

  test('should return 404 when updating non-existent case', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const response = await client
      .patch('/api/v1/cases/999999')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        description: 'Updated description',
      })

    response.assertStatus(404)
  })

  test('should soft delete case (archive)', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    let caseId!: number

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client')
          .with('responsible_lawyer')
          .merge({
            status: 'active',
          })
          .create()
        caseId = caseRecord.id
      }
    )

    const response = await client
      .delete(`/api/v1/cases/${caseId}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(204)

    // Verify case is archived
    const checkResponse = await client
      .get(`/api/v1/cases/${caseId}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    checkResponse.assertStatus(200)
    const body = checkResponse.body()
    assert.equal(body.status, 'archived')
  })

  test('should return 404 when deleting non-existent case', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const response = await client
      .delete('/api/v1/cases/999999')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(404)
  })

  test('should require authentication for all operations', async ({ client }) => {
    const responses = await Promise.all([
      client.get('/api/v1/cases'),
      client.get('/api/v1/cases/1'),
      client.post('/api/v1/cases').json({}),
      client.patch('/api/v1/cases/1').json({}),
      client.delete('/api/v1/cases/1'),
    ])

    responses.forEach((response) => {
      response.assertStatus(401)
    })
  })

  test('should create case with optional CNJ case number', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    let clientId!: number
    let lawyerId!: number

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientRecord = await ClientFactory.create()
        clientId = clientRecord.id
      }
    )

    const lawyer = await UserFactory.create()
    await setupTenantForUser(lawyer, TenantUserRole.LAWYER, tenant)
    lawyerId = lawyer.id

    const response = await client
      .post('/api/v1/cases')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        client_id: clientId,
        responsible_lawyer_id: lawyerId,
        case_type: 'labor',
        case_number: '1234567-89.2024.5.02.0001',
        status: 'active',
        priority: 'high',
      })

    response.assertStatus(201)
    response.assertBodyContains({
      case_number: '1234567-89.2024.5.02.0001',
      case_type: 'labor',
    })
  })

  test('should validate CNJ case number format', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    let clientId!: number
    let lawyerId!: number

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientRecord = await ClientFactory.create()
        clientId = clientRecord.id
      }
    )

    const lawyer = await UserFactory.create()
    await setupTenantForUser(lawyer, TenantUserRole.LAWYER, tenant)
    lawyerId = lawyer.id

    const response = await client
      .post('/api/v1/cases')
      .header('Accept', 'application/json')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        client_id: clientId,
        responsible_lawyer_id: lawyerId,
        case_type: 'civil',
        case_number: 'invalid-format',
        status: 'active',
        priority: 'medium',
      })

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'case_number',
          rule: 'regex',
        },
      ],
    })
  })

  test('should filter cases by priority', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        await CaseFactory.with('client')
          .with('responsible_lawyer')
          .merge({ priority: 'urgent' })
          .createMany(2)
        await CaseFactory.with('client')
          .with('responsible_lawyer')
          .merge({ priority: 'low' })
          .create()
      }
    )

    const response = await client
      .get('/api/v1/cases?priority=urgent')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.isAtLeast(body.data.length, 2)
    body.data.forEach((caseItem: any) => {
      assert.equal(caseItem.priority, 'urgent')
    })
  })

  test('should create case with parties information', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    let clientId!: number
    let lawyerId!: number

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientRecord = await ClientFactory.create()
        clientId = clientRecord.id
      }
    )

    const lawyer = await UserFactory.create()
    await setupTenantForUser(lawyer, TenantUserRole.LAWYER, tenant)
    lawyerId = lawyer.id

    const response = await client
      .post('/api/v1/cases')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        client_id: clientId,
        responsible_lawyer_id: lawyerId,
        case_type: 'civil',
        status: 'active',
        priority: 'medium',
        parties: {
          autor: {
            name: 'João da Silva',
            cpf: '12345678901',
            email: 'joao@example.com',
          },
          reu: {
            name: 'Empresa LTDA',
            cnpj: '12345678000190',
            email: 'empresa@example.com',
          },
        },
      })

    response.assertStatus(201)
    const body = response.body()
    assert.property(body, 'parties')
    assert.property(body.parties, 'autor')
    assert.equal(body.parties.autor.name, 'João da Silva')
  })

  test('should update case status to closed', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    let caseId!: number

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client')
          .with('responsible_lawyer')
          .merge({
            status: 'active',
          })
          .create()
        caseId = caseRecord.id
      }
    )

    const response = await client
      .patch(`/api/v1/cases/${caseId}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        status: 'closed',
        closed_at: '2024-01-15',
      })

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.status, 'closed')
    assert.isNotNull(body.closed_at)
  })
})
