import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import User from '#models/user'
import Tenant from '#models/tenant'
import TenantUser from '#models/tenant_user'

import { TenantFactory } from '#database/factories/tenant_factory'
import { UserFactory } from '#database/factories/user_factory'

test.group('Dashboard E2E - Simple Tests', (group) => {
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

  test('GET /api/v1/dashboard/stats - should return empty stats for new tenant', async ({
    client,
    assert,
  }) => {
    const response = await client
      .get('/api/v1/dashboard/stats')
      .header('Authorization', `Bearer ${authToken}`)
      .header('X-Tenant-ID', tenant.id)

    response.assertStatus(200)

    const stats = response.body()

    assert.property(stats, 'total_clients')
    assert.property(stats, 'total_cases')
    assert.property(stats, 'active_cases')
    assert.property(stats, 'pending_deadlines')
    assert.property(stats, 'overdue_deadlines')
    assert.property(stats, 'total_documents')
    assert.property(stats, 'unbilled_hours')
    assert.property(stats, 'unbilled_amount')
  })

  test('GET /api/v1/dashboard/cases-chart - should return array', async ({ client, assert }) => {
    const response = await client
      .get('/api/v1/dashboard/cases-chart')
      .header('Authorization', `Bearer ${authToken}`)
      .header('X-Tenant-ID', tenant.id)

    response.assertStatus(200)

    const chartData = response.body()

    assert.isArray(chartData)

    // If there's data, verify structure
    if (chartData.length > 0) {
      chartData.forEach((point: any) => {
        assert.property(point, 'date')
        assert.property(point, 'active')
        assert.property(point, 'closed')
        assert.property(point, 'total')
      })
    }
  })

  test('GET /api/v1/dashboard/deadlines-chart - should return array', async ({
    client,
    assert,
  }) => {
    const response = await client
      .get('/api/v1/dashboard/deadlines-chart')
      .header('Authorization', `Bearer ${authToken}`)
      .header('X-Tenant-ID', tenant.id)

    response.assertStatus(200)

    const chartData = response.body()

    assert.isArray(chartData)

    // If there's data, verify structure
    if (chartData.length > 0) {
      chartData.forEach((point: any) => {
        assert.property(point, 'week')
        assert.property(point, 'pending')
        assert.property(point, 'completed')
        assert.property(point, 'overdue')
      })
    }
  })

  test('GET /api/v1/dashboard/recent-clients - should return array', async ({ client, assert }) => {
    const response = await client
      .get('/api/v1/dashboard/recent-clients')
      .header('Authorization', `Bearer ${authToken}`)
      .header('X-Tenant-ID', tenant.id)

    response.assertStatus(200)

    const clients = response.body()

    assert.isArray(clients)

    // If there's data, verify structure
    if (clients.length > 0) {
      clients.forEach((client: any) => {
        assert.property(client, 'id')
        assert.property(client, 'client_type')
        assert.property(client, 'email')
        assert.property(client, 'created_at')
      })
    }
  })

  test('GET /api/v1/dashboard/upcoming-deadlines - should return array', async ({
    client,
    assert,
  }) => {
    const response = await client
      .get('/api/v1/dashboard/upcoming-deadlines')
      .header('Authorization', `Bearer ${authToken}`)
      .header('X-Tenant-ID', tenant.id)

    response.assertStatus(200)

    const deadlines = response.body()

    assert.isArray(deadlines)

    // If there's data, verify structure
    if (deadlines.length > 0) {
      deadlines.forEach((deadline: any) => {
        assert.property(deadline, 'id')
        assert.property(deadline, 'title')
        assert.property(deadline, 'deadline_date')
        assert.property(deadline, 'is_fatal')
        assert.property(deadline, 'status')
      })
    }
  })

  test('GET /api/v1/dashboard/activity-feed - should return array', async ({ client, assert }) => {
    const response = await client
      .get('/api/v1/dashboard/activity-feed')
      .header('Authorization', `Bearer ${authToken}`)
      .header('X-Tenant-ID', tenant.id)

    response.assertStatus(200)

    const activities = response.body()

    assert.isArray(activities)

    // If there's data, verify structure
    if (activities.length > 0) {
      activities.forEach((activity: any) => {
        assert.property(activity, 'id')
        assert.property(activity, 'type')
        assert.property(activity, 'title')
        assert.property(activity, 'description')
        assert.property(activity, 'created_at')
      })
    }
  })

  test('should require authentication for all endpoints', async ({ client }) => {
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

      // Should return 401 Unauthorized without auth token
      response.assertStatus(401)
    }
  })

  test('should require tenant context for all endpoints', async ({ client }) => {
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

      // Should return 403 Forbidden without tenant context
      response.assertStatus(403)
    }
  })
})
