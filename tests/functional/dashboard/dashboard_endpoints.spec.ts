import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import User from '#models/user'
import Tenant from '#models/tenant'
import TenantUser from '#models/tenant_user'
import Client from '#models/client'
import Case from '#models/case'
import Deadline from '#models/deadline'
import Document from '#models/document'
import CaseEvent from '#models/case_event'

import { TenantFactory } from '#database/factories/tenant_factory'
import { UserFactory } from '#database/factories/user_factory'
import { ClientFactory } from '#database/factories/client_factory'
import { CaseFactory } from '#database/factories/case_factory'
import { DeadlineFactory } from '#database/factories/deadline_factory'
import { DocumentFactory } from '#database/factories/document_factory'

import TenantContextService from '#services/tenants/tenant_context_service'
import { DateTime } from 'luxon'

test.group('Dashboard Endpoints E2E', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  let user: User
  let tenant: Tenant
  let authToken: string

  group.each.setup(async () => {
    // Create user and tenant
    user = await UserFactory.create()
    tenant = await TenantFactory.create()

    // Associate user with tenant
    await TenantUser.create({
      user_id: user.id,
      tenant_id: tenant.id,
      role: 'admin',
    })

    // Generate auth token
    const token = await User.accessTokens.create(user)
    authToken = token.value!.release()
  })

  test('GET /api/v1/dashboard/stats - should return dashboard statistics', async ({
    client,
    assert,
  }) => {
    // Create test data within tenant context
    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        // Create 5 clients
        await ClientFactory.merge({ tenant_id: tenant.id }).createMany(5)

        // Create 10 cases (7 active, 3 closed)
        await CaseFactory.merge({ tenant_id: tenant.id, status: 'active' }).createMany(7)
        await CaseFactory.merge({ tenant_id: tenant.id, status: 'closed' }).createMany(3)

        // Create deadlines (5 pending, 2 overdue, 3 completed)
        const tomorrow = DateTime.now().plus({ days: 1 }).toJSDate()
        const yesterday = DateTime.now().minus({ days: 1 }).toJSDate()

        await DeadlineFactory.merge({
          tenant_id: tenant.id,
          status: 'pending',
          deadline_date: tomorrow,
        }).createMany(5)

        await DeadlineFactory.merge({
          tenant_id: tenant.id,
          status: 'pending',
          deadline_date: yesterday,
        }).createMany(2)

        await DeadlineFactory.merge({
          tenant_id: tenant.id,
          status: 'completed',
          deadline_date: yesterday,
        }).createMany(3)

        // Create 15 documents
        await DocumentFactory.merge({ tenant_id: tenant.id }).createMany(15)
      }
    )

    // Make API request
    const response = await client
      .get('/api/v1/dashboard/stats')
      .header('Authorization', `Bearer ${authToken}`)
      .header('X-Tenant-ID', tenant.id)

    response.assertStatus(200)

    const stats = response.body()

    assert.equal(stats.total_clients, 5)
    assert.equal(stats.total_cases, 10)
    assert.equal(stats.active_cases, 7)
    assert.equal(stats.pending_deadlines, 7) // 5 future + 2 overdue
    assert.equal(stats.overdue_deadlines, 2)
    assert.equal(stats.total_documents, 15)
    assert.isDefined(stats.unbilled_hours)
    assert.isDefined(stats.unbilled_amount)
  })

  test('GET /api/v1/dashboard/cases-chart - should return cases chart data', async ({
    client,
    assert,
  }) => {
    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        const today = DateTime.now()

        // Create cases from different dates
        for (let i = 0; i < 12; i++) {
          const date = today.minus({ months: i }).toJSDate()

          // Active cases
          await CaseFactory.merge({
            tenant_id: tenant.id,
            status: 'active',
            created_at: date,
          }).createMany(2)

          // Closed cases
          await CaseFactory.merge({
            tenant_id: tenant.id,
            status: 'closed',
            created_at: date,
          }).create()
        }
      }
    )

    const response = await client
      .get('/api/v1/dashboard/cases-chart')
      .header('Authorization', `Bearer ${authToken}`)
      .header('X-Tenant-ID', tenant.id)

    response.assertStatus(200)

    const chartData = response.body()

    assert.isArray(chartData)
    assert.isNotEmpty(chartData)

    // Verify data structure
    chartData.forEach((point: any) => {
      assert.property(point, 'date')
      assert.property(point, 'active')
      assert.property(point, 'closed')
      assert.property(point, 'total')
      assert.isNumber(point.active)
      assert.isNumber(point.closed)
      assert.isNumber(point.total)
    })
  })

  test('GET /api/v1/dashboard/deadlines-chart - should return deadlines chart data', async ({
    client,
    assert,
  }) => {
    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        const today = DateTime.now()

        // Create deadlines for next 7 days
        for (let i = 0; i < 7; i++) {
          const date = today.plus({ days: i }).toJSDate()

          // Pending
          await DeadlineFactory.merge({
            tenant_id: tenant.id,
            status: 'pending',
            deadline_date: date,
          }).createMany(2)

          // Completed
          await DeadlineFactory.merge({
            tenant_id: tenant.id,
            status: 'completed',
            deadline_date: date,
          }).create()

          // Overdue (past deadlines still pending)
          if (i < 2) {
            const pastDate = today.minus({ days: i + 1 }).toJSDate()
            await DeadlineFactory.merge({
              tenant_id: tenant.id,
              status: 'pending',
              deadline_date: pastDate,
            }).create()
          }
        }
      }
    )

    const response = await client
      .get('/api/v1/dashboard/deadlines-chart')
      .header('Authorization', `Bearer ${authToken}`)
      .header('X-Tenant-ID', tenant.id)

    response.assertStatus(200)

    const chartData = response.body()

    assert.isArray(chartData)
    assert.isNotEmpty(chartData)

    // Verify data structure
    chartData.forEach((point: any) => {
      assert.property(point, 'week')
      assert.property(point, 'pending')
      assert.property(point, 'completed')
      assert.property(point, 'overdue')
      assert.isNumber(point.pending)
      assert.isNumber(point.completed)
      assert.isNumber(point.overdue)
    })
  })

  test('GET /api/v1/dashboard/recent-clients - should return recent clients', async ({
    client,
    assert,
  }) => {
    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        // Create individual clients
        await ClientFactory.merge({
          tenant_id: tenant.id,
          client_type: 'individual',
          full_name: 'João Silva Santos',
        }).create()

        await ClientFactory.merge({
          tenant_id: tenant.id,
          client_type: 'individual',
          full_name: 'Maria Oliveira Costa',
        }).create()

        // Create company clients
        await ClientFactory.merge({
          tenant_id: tenant.id,
          client_type: 'company',
          company_name: 'Empresa ABC Ltda',
        }).create()

        await ClientFactory.merge({
          tenant_id: tenant.id,
          client_type: 'company',
          company_name: 'Tech Solutions S.A.',
        }).create()
      }
    )

    const response = await client
      .get('/api/v1/dashboard/recent-clients')
      .header('Authorization', `Bearer ${authToken}`)
      .header('X-Tenant-ID', tenant.id)

    response.assertStatus(200)

    const clients = response.body()

    assert.isArray(clients)
    assert.lengthOf(clients, 4)

    // Verify data structure
    clients.forEach((client: any) => {
      assert.property(client, 'id')
      assert.property(client, 'client_type')
      assert.property(client, 'email')
      assert.property(client, 'created_at')

      if (client.client_type === 'individual') {
        assert.property(client, 'full_name')
      } else {
        assert.property(client, 'company_name')
      }
    })
  })

  test('GET /api/v1/dashboard/upcoming-deadlines - should return upcoming deadlines', async ({
    client,
    assert,
  }) => {
    let caseRecord: Case

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        // Create a case
        caseRecord = await CaseFactory.merge({
          tenant_id: tenant.id,
          case_number: '0123456-78.2024.8.26.0100',
          title: 'Ação de Indenização',
        }).create()

        // Create upcoming deadlines
        const tomorrow = DateTime.now().plus({ days: 1 }).toJSDate()
        const nextWeek = DateTime.now().plus({ days: 7 }).toJSDate()
        const urgent = DateTime.now().plus({ hours: 12 }).toJSDate()

        await DeadlineFactory.merge({
          tenant_id: tenant.id,
          case_id: caseRecord.id,
          title: 'Contestação',
          deadline_date: tomorrow,
          status: 'pending',
          is_fatal: true,
        }).create()

        await DeadlineFactory.merge({
          tenant_id: tenant.id,
          case_id: caseRecord.id,
          title: 'Réplica',
          deadline_date: nextWeek,
          status: 'pending',
          is_fatal: false,
        }).create()

        await DeadlineFactory.merge({
          tenant_id: tenant.id,
          case_id: caseRecord.id,
          title: 'Petição Urgente',
          deadline_date: urgent,
          status: 'pending',
          is_fatal: true,
        }).create()
      }
    )

    const response = await client
      .get('/api/v1/dashboard/upcoming-deadlines')
      .header('Authorization', `Bearer ${authToken}`)
      .header('X-Tenant-ID', tenant.id)

    response.assertStatus(200)

    const deadlines = response.body()

    assert.isArray(deadlines)
    assert.isNotEmpty(deadlines)

    // Verify data structure
    deadlines.forEach((deadline: any) => {
      assert.property(deadline, 'id')
      assert.property(deadline, 'title')
      assert.property(deadline, 'deadline_date')
      assert.property(deadline, 'is_fatal')
      assert.property(deadline, 'status')
      assert.property(deadline, 'case')

      // Verify case details
      if (deadline.case) {
        assert.property(deadline.case, 'id')
        assert.property(deadline.case, 'title')
      }
    })
  })

  test('GET /api/v1/dashboard/activity-feed - should return activity feed', async ({
    client,
    assert,
  }) => {
    let caseRecord: Case
    let clientRecord: Client

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        // Create test data
        clientRecord = await ClientFactory.merge({ tenant_id: tenant.id }).create()
        caseRecord = await CaseFactory.merge({ tenant_id: tenant.id }).create()

        // Create case events (activity feed items)
        await CaseEvent.create({
          tenant_id: tenant.id,
          case_id: caseRecord.id,
          type: 'filing',
          title: 'Petição Inicial Protocolada',
          description: 'Processo iniciado no TJ-SP',
          event_date: DateTime.now().minus({ hours: 2 }).toJSDate(),
          created_by_user_id: user.id,
        })

        await CaseEvent.create({
          tenant_id: tenant.id,
          case_id: caseRecord.id,
          type: 'hearing',
          title: 'Audiência Agendada',
          description: 'Audiência de conciliação marcada para próxima semana',
          event_date: DateTime.now().minus({ hours: 1 }).toJSDate(),
          created_by_user_id: user.id,
        })

        await CaseEvent.create({
          tenant_id: tenant.id,
          case_id: caseRecord.id,
          type: 'decision',
          title: 'Decisão Liminar',
          description: 'Juiz deferiu pedido liminar',
          event_date: DateTime.now().minus({ minutes: 30 }).toJSDate(),
          created_by_user_id: user.id,
        })
      }
    )

    const response = await client
      .get('/api/v1/dashboard/activity-feed')
      .header('Authorization', `Bearer ${authToken}`)
      .header('X-Tenant-ID', tenant.id)

    response.assertStatus(200)

    const activities = response.body()

    assert.isArray(activities)
    assert.isNotEmpty(activities)

    // Verify data structure
    activities.forEach((activity: any) => {
      assert.property(activity, 'id')
      assert.property(activity, 'type')
      assert.property(activity, 'title')
      assert.property(activity, 'description')
      assert.property(activity, 'created_at')

      // Activity types should match expected values
      assert.include(
        ['case_created', 'deadline_added', 'document_uploaded', 'client_created', 'event_logged'],
        activity.type
      )
    })
  })

  test('should deny access without authentication', async ({ client }) => {
    const endpoints = [
      '/api/v1/dashboard/stats',
      '/api/v1/dashboard/cases-chart',
      '/api/v1/dashboard/deadlines-chart',
      '/api/v1/dashboard/recent-clients',
      '/api/v1/dashboard/upcoming-deadlines',
      '/api/v1/dashboard/activity-feed',
    ]

    for (const endpoint of endpoints) {
      const response = await client.get(endpoint).header('X-Tenant-ID', tenant.id)

      response.assertStatus(401)
    }
  })

  test('should deny access without tenant context', async ({ client }) => {
    const endpoints = [
      '/api/v1/dashboard/stats',
      '/api/v1/dashboard/cases-chart',
      '/api/v1/dashboard/deadlines-chart',
      '/api/v1/dashboard/recent-clients',
      '/api/v1/dashboard/upcoming-deadlines',
      '/api/v1/dashboard/activity-feed',
    ]

    for (const endpoint of endpoints) {
      const response = await client.get(endpoint).header('Authorization', `Bearer ${authToken}`)
      // No X-Tenant-ID header

      response.assertStatus(403)
    }
  })

  test('should return empty results for tenant with no data', async ({ client, assert }) => {
    // Create a new tenant with no data
    const emptyTenant = await TenantFactory.create()
    await TenantUser.create({
      user_id: user.id,
      tenant_id: emptyTenant.id,
      role: 'admin',
    })

    // Test stats endpoint
    const statsResponse = await client
      .get('/api/v1/dashboard/stats')
      .header('Authorization', `Bearer ${authToken}`)
      .header('X-Tenant-ID', emptyTenant.id)

    statsResponse.assertStatus(200)

    const stats = statsResponse.body()
    assert.equal(stats.total_clients, 0)
    assert.equal(stats.total_cases, 0)
    assert.equal(stats.active_cases, 0)
    assert.equal(stats.pending_deadlines, 0)
    assert.equal(stats.overdue_deadlines, 0)
    assert.equal(stats.total_documents, 0)

    // Test recent clients endpoint
    const clientsResponse = await client
      .get('/api/v1/dashboard/recent-clients')
      .header('Authorization', `Bearer ${authToken}`)
      .header('X-Tenant-ID', emptyTenant.id)

    clientsResponse.assertStatus(200)
    assert.isArray(clientsResponse.body())
    assert.isEmpty(clientsResponse.body())

    // Test upcoming deadlines endpoint
    const deadlinesResponse = await client
      .get('/api/v1/dashboard/upcoming-deadlines')
      .header('Authorization', `Bearer ${authToken}`)
      .header('X-Tenant-ID', emptyTenant.id)

    deadlinesResponse.assertStatus(200)
    assert.isArray(deadlinesResponse.body())
    assert.isEmpty(deadlinesResponse.body())
  })
})
