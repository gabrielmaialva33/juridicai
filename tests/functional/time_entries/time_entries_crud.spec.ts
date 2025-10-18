import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { UserFactory } from '#database/factories/user_factory'
import { CaseFactory } from '#database/factories/case_factory'
import { TimeEntryFactory } from '#database/factories/time_entry_factory'
import { setupTenantForUser } from '#tests/utils/tenant_test_helper'
import TenantContextService from '#services/tenants/tenant_context_service'
import { TenantUserRole } from '#models/tenant_user'
import { DateTime } from 'luxon'

test.group('Time Entries CRUD', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should start a new timer', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user, TenantUserRole.LAWYER)

    let caseId!: number

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        caseId = caseRecord.id
      }
    )

    const response = await client
      .post('/api/v1/time-entries/start')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        case_id: caseId,
        description: 'Working on initial petition',
      })

    response.assertStatus(201)
    const body = response.body()
    assert.property(body, 'id')
    assert.equal(body.case_id, caseId)
    assert.equal(body.user_id, user.id)
    assert.exists(body.started_at)
    assert.isNull(body.ended_at)
    assert.isNull(body.duration_minutes)
  })

  test('should stop an active timer', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user, TenantUserRole.LAWYER)

    let timeEntryId!: number

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const timeEntry = await TimeEntryFactory.merge({
          user_id: user.id,
          case_id: caseRecord.id,
          started_at: DateTime.now().minus({ minutes: 30 }),
          ended_at: null,
        }).create()
        timeEntryId = timeEntry.id
      }
    )

    const response = await client
      .post(`/api/v1/time-entries/${timeEntryId}/stop`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.exists(body.ended_at)
    assert.isNumber(body.duration_minutes)
    assert.isAtLeast(body.duration_minutes, 29) // Should be ~30 minutes
    assert.isAtMost(body.duration_minutes, 31)
  })

  test('should fail to stop a timer that is already stopped', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user, TenantUserRole.LAWYER)

    let timeEntryId!: number

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const timeEntry = await TimeEntryFactory.merge({
          user_id: user.id,
          case_id: caseRecord.id,
          started_at: DateTime.now().minus({ hours: 1 }),
          ended_at: DateTime.now().minus({ minutes: 30 }),
          duration_minutes: 30,
        }).create()
        timeEntryId = timeEntry.id
      }
    )

    const response = await client
      .post(`/api/v1/time-entries/${timeEntryId}/stop`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(400)
  })

  test('should create a manual time entry', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user, TenantUserRole.LAWYER)

    let caseId!: number

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        caseId = caseRecord.id
      }
    )

    const startedAt = '2024-01-15T09:00:00'
    const endedAt = '2024-01-15T11:30:00'

    const response = await client
      .post('/api/v1/time-entries')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        case_id: caseId,
        description: 'Research on case law',
        started_at: startedAt,
        ended_at: endedAt,
        billable: true,
        hourly_rate: 300.0,
        tags: ['research', 'case_law'],
      })

    response.assertStatus(201)
    const body = response.body()
    assert.equal(body.case_id, caseId)
    assert.equal(body.duration_minutes, 150) // 2.5 hours = 150 minutes
    assert.equal(body.billable, true)
    assert.equal(body.hourly_rate, 300.0)
    assert.equal(body.amount, 750.0) // 2.5 * 300
    assert.deepEqual(body.tags, ['research', 'case_law'])
  })

  test('should validate required fields on manual entry creation', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user, TenantUserRole.LAWYER)

    const response = await client
      .post('/api/v1/time-entries')
      .header('Accept', 'application/json')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        description: 'Missing case_id and dates',
      })

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'case_id',
          rule: 'required',
        },
        {
          field: 'started_at',
          rule: 'required',
        },
        {
          field: 'ended_at',
          rule: 'required',
        },
      ],
    })
  })

  test('should list time entries with pagination', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user, TenantUserRole.LAWYER)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        await TimeEntryFactory.merge({
          user_id: user.id,
          case_id: caseRecord.id,
        }).createMany(5)
      }
    )

    const response = await client
      .get('/api/v1/time-entries')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.property(body, 'data')
    assert.property(body, 'meta')
    assert.isArray(body.data)
    assert.isAtLeast(body.data.length, 5)
  })

  test('should filter time entries by case_id', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user, TenantUserRole.LAWYER)

    let targetCaseId!: number

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        const case1 = await CaseFactory.with('client').with('responsible_lawyer').create()
        const case2 = await CaseFactory.with('client').with('responsible_lawyer').create()

        targetCaseId = case1.id

        await TimeEntryFactory.merge({
          user_id: user.id,
          case_id: case1.id,
        }).createMany(3)
        await TimeEntryFactory.merge({
          user_id: user.id,
          case_id: case2.id,
        }).createMany(2)
      }
    )

    const response = await client
      .get(`/api/v1/time-entries?case_id=${targetCaseId}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.isAtLeast(body.data.length, 3)
    body.data.forEach((entry: any) => {
      assert.equal(entry.case_id, targetCaseId)
    })
  })

  test('should filter time entries by billable status', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user, TenantUserRole.LAWYER)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()

        await TimeEntryFactory.merge({
          user_id: user.id,
          case_id: caseRecord.id,
          billable: true,
        }).createMany(3)
        await TimeEntryFactory.merge({
          user_id: user.id,
          case_id: caseRecord.id,
          billable: false,
        }).createMany(2)
      }
    )

    const response = await client
      .get('/api/v1/time-entries?billable=true')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.isAtLeast(body.data.length, 3)
    body.data.forEach((entry: any) => {
      assert.equal(entry.billable, true)
    })
  })

  test('should filter time entries by date range', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user, TenantUserRole.LAWYER)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()

        // Entries in January 2024
        await TimeEntryFactory.merge({
          user_id: user.id,
          case_id: caseRecord.id,
          started_at: DateTime.fromISO('2024-01-15T09:00:00'),
          ended_at: DateTime.fromISO('2024-01-15T10:00:00'),
        }).createMany(2)

        // Entries in February 2024
        await TimeEntryFactory.merge({
          user_id: user.id,
          case_id: caseRecord.id,
          started_at: DateTime.fromISO('2024-02-15T09:00:00'),
          ended_at: DateTime.fromISO('2024-02-15T10:00:00'),
        }).createMany(2)
      }
    )

    const response = await client
      .get('/api/v1/time-entries?from_date=2024-01-01&to_date=2024-01-31')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.data.length, 2)
  })

  test('should get time entry stats', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user, TenantUserRole.LAWYER)

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()

        await TimeEntryFactory.merge({
          user_id: user.id,
          case_id: caseRecord.id,
          duration_minutes: 120,
          billable: true,
          hourly_rate: 300.0,
        }).create()

        await TimeEntryFactory.merge({
          user_id: user.id,
          case_id: caseRecord.id,
          duration_minutes: 90,
          billable: true,
          hourly_rate: 300.0,
        }).create()

        await TimeEntryFactory.merge({
          user_id: user.id,
          case_id: caseRecord.id,
          duration_minutes: 60,
          billable: false,
        }).create()
      }
    )

    const response = await client
      .get('/api/v1/time-entries/stats')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.property(body, 'total_hours')
    assert.property(body, 'billable_hours')
    assert.property(body, 'non_billable_hours')
    assert.property(body, 'total_amount')
    assert.equal(body.total_hours, 4.5) // 270 minutes = 4.5 hours
    assert.equal(body.billable_hours, 3.5) // 210 minutes = 3.5 hours
    assert.equal(body.non_billable_hours, 1.0) // 60 minutes = 1 hour
    assert.equal(body.total_amount, 1050.0) // 3.5 * 300
  })

  test('should update time entry', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user, TenantUserRole.LAWYER)

    let timeEntryId!: number

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const timeEntry = await TimeEntryFactory.merge({
          user_id: user.id,
          case_id: caseRecord.id,
          description: 'Original description',
          billable: false,
        }).create()
        timeEntryId = timeEntry.id
      }
    )

    const response = await client
      .patch(`/api/v1/time-entries/${timeEntryId}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json({
        description: 'Updated description',
        billable: true,
        hourly_rate: 350.0,
      })

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.description, 'Updated description')
    assert.equal(body.billable, true)
    assert.equal(body.hourly_rate, 350.0)
  })

  test('should soft delete time entry', async ({ client }) => {
    const user = await UserFactory.create()
    const tenant = await setupTenantForUser(user, TenantUserRole.LAWYER)

    let timeEntryId!: number

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user.id, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const timeEntry = await TimeEntryFactory.merge({
          user_id: user.id,
          case_id: caseRecord.id,
        }).create()
        timeEntryId = timeEntry.id
      }
    )

    const response = await client
      .delete(`/api/v1/time-entries/${timeEntryId}`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    response.assertStatus(204)

    // Verify it's not in the list anymore (soft deleted)
    const listResponse = await client
      .get('/api/v1/time-entries')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)

    const body = listResponse.body()
    const deletedEntry = body.data.find((entry: any) => entry.id === timeEntryId)
    assert.isUndefined(deletedEntry)
  })

  test('should require authentication for all operations', async ({ client }) => {
    const responses = await Promise.all([
      client.get('/api/v1/time-entries'),
      client.post('/api/v1/time-entries/start').json({}),
      client.post('/api/v1/time-entries').json({}),
      client.patch('/api/v1/time-entries/1').json({}),
      client.delete('/api/v1/time-entries/1'),
    ])

    responses.forEach((response) => {
      response.assertStatus(401)
    })
  })

  test('should only allow user to stop their own timer', async ({ client }) => {
    const user1 = await UserFactory.create()
    const user2 = await UserFactory.create()
    const tenant = await setupTenantForUser(user1, TenantUserRole.LAWYER)
    await setupTenantForUser(user2, TenantUserRole.LAWYER, tenant)

    let timeEntryId!: number

    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: user1.id, tenant_user: null },
      async () => {
        const caseRecord = await CaseFactory.with('client').with('responsible_lawyer').create()
        const timeEntry = await TimeEntryFactory.merge({
          user_id: user1.id,
          case_id: caseRecord.id,
          started_at: DateTime.now().minus({ minutes: 30 }),
          ended_at: null,
        }).create()
        timeEntryId = timeEntry.id
      }
    )

    // User2 tries to stop User1's timer
    const response = await client
      .post(`/api/v1/time-entries/${timeEntryId}/stop`)
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user2)

    response.assertStatus(403) // Forbidden
  })
})
