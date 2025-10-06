import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'
import { ClientFactory } from '#database/factories/client_factory'
import { CaseFactory } from '#database/factories/case_factory'
import { DeadlineFactory } from '#database/factories/deadline_factory'
import { setupTenantForUser } from '#tests/utils/tenant_test_helper'
import TenantContextService from '#services/tenants/tenant_context_service'
import Deadline from '#models/deadline'

test.group('Deadlines CRUD', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('GET /api/v1/deadlines - should list deadlines with pagination', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const { caseModel } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const createdCase = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        await DeadlineFactory.merge({
          case_id: createdCase.id,
          responsible_id: user.id,
        }).createMany(3)

        return { caseModel: createdCase }
      }
    )

    const response = await client
      .get('/api/v1/deadlines')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({
      meta: {
        total: 3,
        per_page: 20,
        current_page: 1,
      },
    })

    const body = response.body()
    assert.equal(body.data.length, 3)
    assert.isTrue(body.data.every((d: any) => d.case_id === caseModel.id))
  })

  test('GET /api/v1/deadlines?case_id=X - should filter deadlines by case', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

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

        // Create deadlines for case1
        await DeadlineFactory.merge({
          case_id: createdCase1.id,
          responsible_id: user.id,
        }).createMany(2)

        // Create deadline for case2
        await DeadlineFactory.merge({
          case_id: case2.id,
          responsible_id: user.id,
        }).create()

        return { case1: createdCase1 }
      }
    )

    const response = await client
      .get(`/api/v1/deadlines?case_id=${case1.id}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)

    const body = response.body()
    assert.equal(body.meta.total, 2)
    assert.isTrue(body.data.every((d: any) => d.case_id === case1.id))
  })

  test('GET /api/v1/deadlines?status=pending - should filter deadlines by status', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        // Create pending deadlines
        await DeadlineFactory.merge({
          case_id: caseModel.id,
          responsible_id: user.id,
        })
          .apply('pending')
          .createMany(2)

        // Create completed deadline
        await DeadlineFactory.merge({
          case_id: caseModel.id,
          responsible_id: user.id,
        })
          .apply('completed')
          .create()
      }
    )

    const response = await client
      .get('/api/v1/deadlines?status=pending')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)

    const body = response.body()
    assert.equal(body.meta.total, 2)
    assert.isTrue(body.data.every((d: any) => d.status === 'pending'))
  })

  test('GET /api/v1/deadlines?is_fatal=true - should filter deadlines by is_fatal', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        // Create fatal deadlines
        await DeadlineFactory.merge({
          case_id: caseModel.id,
          responsible_id: user.id,
        })
          .apply('fatal')
          .createMany(2)

        // Create non-fatal deadline
        await DeadlineFactory.merge({
          case_id: caseModel.id,
          responsible_id: user.id,
          is_fatal: false,
        }).create()
      }
    )

    const response = await client
      .get('/api/v1/deadlines?is_fatal=true')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)

    const body = response.body()
    assert.equal(body.meta.total, 2)
    assert.isTrue(body.data.every((d: any) => d.is_fatal === true))
  })

  test('GET /api/v1/deadlines/upcoming - should get upcoming deadlines', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        // Create upcoming deadline (within 7 days)
        await DeadlineFactory.merge({
          case_id: caseModel.id,
          responsible_id: user.id,
          deadline_date: DateTime.now().plus({ days: 5 }),
          status: 'pending',
        }).create()

        // Create far future deadline (beyond 7 days)
        await DeadlineFactory.merge({
          case_id: caseModel.id,
          responsible_id: user.id,
          deadline_date: DateTime.now().plus({ days: 30 }),
          status: 'pending',
        }).create()

        // Create completed deadline
        await DeadlineFactory.merge({
          case_id: caseModel.id,
          responsible_id: user.id,
          deadline_date: DateTime.now().plus({ days: 3 }),
        })
          .apply('completed')
          .create()
      }
    )

    const response = await client
      .get('/api/v1/deadlines/upcoming')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)

    const body = response.body()
    assert.equal(body.length, 1)
    assert.equal(body[0].status, 'pending')
  })

  test('GET /api/v1/deadlines/upcoming?days=30 - should get upcoming deadlines with custom days', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        // Create deadline within 30 days
        await DeadlineFactory.merge({
          case_id: caseModel.id,
          responsible_id: user.id,
          deadline_date: DateTime.now().plus({ days: 25 }),
          status: 'pending',
        }).create()

        // Create deadline within 7 days
        await DeadlineFactory.merge({
          case_id: caseModel.id,
          responsible_id: user.id,
          deadline_date: DateTime.now().plus({ days: 5 }),
          status: 'pending',
        }).create()

        // Create deadline beyond 30 days
        await DeadlineFactory.merge({
          case_id: caseModel.id,
          responsible_id: user.id,
          deadline_date: DateTime.now().plus({ days: 35 }),
          status: 'pending',
        }).create()
      }
    )

    const response = await client
      .get('/api/v1/deadlines/upcoming?days=30')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)

    const body = response.body()
    assert.equal(body.length, 2)
    assert.isTrue(body.every((d: any) => d.status === 'pending'))
  })

  test('GET /api/v1/deadlines/:id - should get deadline by ID', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const { deadline } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        const createdDeadline = await DeadlineFactory.merge({
          case_id: caseModel.id,
          responsible_id: user.id,
        }).create()

        return { deadline: createdDeadline }
      }
    )

    const response = await client
      .get(`/api/v1/deadlines/${deadline.id}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({
      id: deadline.id,
      title: deadline.title,
      status: deadline.status,
    })
  })

  test('GET /api/v1/deadlines/:id - should return 404 for non-existent deadline', async ({
    client,
  }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const response = await client
      .get('/api/v1/deadlines/999999')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(404)
    response.assertBodyContains({
      message: 'Deadline not found',
    })
  })

  test('POST /api/v1/deadlines - should create deadline with valid data', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const { caseModel } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const createdCase = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        return { caseModel: createdCase }
      }
    )

    const deadlineData = {
      case_id: caseModel.id,
      responsible_id: user.id,
      title: 'Prazo para contestação',
      description: 'Apresentar contestação no processo',
      deadline_date: DateTime.now().plus({ days: 15 }).toFormat('yyyy-MM-dd'),
      internal_deadline_date: DateTime.now().plus({ days: 10 }).toFormat('yyyy-MM-dd'),
      is_fatal: true,
    }

    const response = await client
      .post('/api/v1/deadlines')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json(deadlineData)

    response.assertStatus(201)
    response.assertBodyContains({
      title: deadlineData.title,
      description: deadlineData.description,
      is_fatal: true,
      status: 'pending',
    })

    const createdDeadline = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        return await Deadline.findBy('title', deadlineData.title)
      }
    )

    assert.isNotNull(createdDeadline)
    assert.equal(createdDeadline!.tenant_id, tenant.id)
  })

  test('POST /api/v1/deadlines - should validate required fields', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const response = await client
      .post('/api/v1/deadlines')
      .header('Accept', 'application/json')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        title: 'Te', // Too short
      })

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'case_id',
          rule: 'required',
        },
        {
          field: 'responsible_id',
          rule: 'required',
        },
        {
          field: 'title',
          rule: 'minLength',
        },
        {
          field: 'deadline_date',
          rule: 'required',
        },
      ],
    })
  })

  test('PATCH /api/v1/deadlines/:id - should update deadline', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const { deadline } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        const createdDeadline = await DeadlineFactory.merge({
          case_id: caseModel.id,
          responsible_id: user.id,
          title: 'Old Title',
          is_fatal: false,
        }).create()

        return { deadline: createdDeadline }
      }
    )

    const updateData = {
      title: 'Updated Title',
      is_fatal: true,
    }

    const response = await client
      .patch(`/api/v1/deadlines/${deadline.id}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json(updateData)

    response.assertStatus(200)
    response.assertBodyContains({
      id: deadline.id,
      title: updateData.title,
      is_fatal: true,
    })

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        await deadline.refresh()
        assert.equal(deadline.title, updateData.title)
        assert.equal(deadline.is_fatal, true)
      }
    )
  })

  test('PATCH /api/v1/deadlines/:id/complete - should complete deadline with completion_notes', async ({
    client,
  }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const { deadline } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        const createdDeadline = await DeadlineFactory.merge({
          case_id: caseModel.id,
          responsible_id: user.id,
          status: 'pending',
        }).create()

        return { deadline: createdDeadline }
      }
    )

    const response = await client
      .patch(`/api/v1/deadlines/${deadline.id}/complete`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        completion_notes: 'Tarefa concluída com sucesso',
      })

    response.assertStatus(200)
    response.assertBodyContains({
      status: 'completed',
      completion_notes: 'Tarefa concluída com sucesso',
    })
  })

  test('PATCH /api/v1/deadlines/:id/complete - should set status, completed_at, and completed_by', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const { deadline } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        const createdDeadline = await DeadlineFactory.merge({
          case_id: caseModel.id,
          responsible_id: user.id,
          status: 'pending',
        }).create()

        return { deadline: createdDeadline }
      }
    )

    const response = await client
      .patch(`/api/v1/deadlines/${deadline.id}/complete`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        completion_notes: 'Completed successfully',
      })

    response.assertStatus(200)

    const body = response.body()
    assert.equal(body.status, 'completed')
    assert.isNotNull(body.completed_at)
    assert.equal(body.completed_by, user.id)
    assert.equal(body.completion_notes, 'Completed successfully')

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        await deadline.refresh()
        assert.equal(deadline.status, 'completed')
        assert.isNotNull(deadline.completed_at)
        assert.equal(deadline.completed_by, user.id)
      }
    )
  })

  test('DELETE /api/v1/deadlines/:id - should delete deadline (soft delete with status=cancelled)', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user)

    const { deadline } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const clientModel = await ClientFactory.create()
        const caseModel = await CaseFactory.merge({
          client_id: clientModel.id,
          responsible_lawyer_id: user.id,
        }).create()

        const createdDeadline = await DeadlineFactory.merge({
          case_id: caseModel.id,
          responsible_id: user.id,
        }).create()

        return { deadline: createdDeadline }
      }
    )

    const response = await client
      .delete(`/api/v1/deadlines/${deadline.id}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(204)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        await deadline.refresh()
        assert.equal(deadline.status, 'cancelled')
      }
    )
  })

  test('should require authentication for all deadline operations', async ({ client }) => {
    const responses = await Promise.all([
      client.get('/api/v1/deadlines'),
      client.get('/api/v1/deadlines/upcoming'),
      client.get('/api/v1/deadlines/1'),
      client.post('/api/v1/deadlines').json({}),
      client.patch('/api/v1/deadlines/1').json({}),
      client.patch('/api/v1/deadlines/1/complete').json({}),
      client.delete('/api/v1/deadlines/1'),
    ])

    responses.forEach((response) => {
      response.assertStatus(401)
    })
  })
})
