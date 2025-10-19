import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'
import { UserFactory } from '#database/factories/user_factory'
import { AuditLogFactory } from '#database/factories/audit_log_factory'
import AuditLogsRepository from '#repositories/audit_logs_repository'
import { withTenantContext } from '#tests/utils/tenant_context_helper'

test.group('AuditLogsRepository', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('getUserLogs returns logs for specific user', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()
      await AuditLogFactory.merge({ user_id: user.id }).createMany(3)
      await AuditLogFactory.createMany(2) // Other users

      const repository = await app.container.make(AuditLogsRepository)
      const result = await repository.getUserLogs(user.id)

      assert.lengthOf(result, 3)
      result.forEach((log: any) => assert.equal(log.user_id, user.id))
    })
  })

  test('getUserLogs respects limit parameter', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()
      await AuditLogFactory.merge({ user_id: user.id }).createMany(10)

      const repository = await app.container.make(AuditLogsRepository)
      const result = await repository.getUserLogs(user.id, 5)

      assert.lengthOf(result, 5)
    })
  })

  test('getSecurityAlerts returns only denied logs', async ({ assert }) => {
    await withTenantContext(async () => {
      await AuditLogFactory.apply('granted').createMany(5)
      await AuditLogFactory.apply('denied').createMany(3)

      const repository = await app.container.make(AuditLogsRepository)
      const result = await repository.getSecurityAlerts(30)

      assert.lengthOf(result, 3)
      result.forEach((log: any) => assert.equal(log.result, 'denied'))
    })
  })

  test('getSecurityAlerts filters by date range', async ({ assert }) => {
    await withTenantContext(async () => {
      const oldLog = await AuditLogFactory.apply('denied').create()
      // Force created_at to 30 days ago
      oldLog.created_at = DateTime.now().minus({ days: 30 })
      await oldLog.save()

      await AuditLogFactory.apply('denied').createMany(2)

      const repository = await app.container.make(AuditLogsRepository)
      const result = await repository.getSecurityAlerts(7)

      assert.lengthOf(result, 2)
    })
  })

  test('getStatsByDateRange returns aggregated statistics', async ({ assert }) => {
    await withTenantContext(async () => {
      const startDate = DateTime.now().minus({ days: 7 })
      const endDate = DateTime.now()

      await AuditLogFactory.apply('granted').createMany(5)
      await AuditLogFactory.apply('denied').createMany(3)

      const repository = await app.container.make(AuditLogsRepository)
      const result = await repository.getStatsByDateRange(startDate, endDate)

      assert.exists(result.summary)
      assert.exists(result.daily)
      assert.exists(result.byAction)
      assert.exists(result.byResource)
    })
  })

  test('cleanupOldLogs deletes logs older than specified days', async ({ assert }) => {
    await withTenantContext(async () => {
      const oldLog = await AuditLogFactory.create()
      oldLog.created_at = DateTime.now().minus({ days: 100 })
      await oldLog.save()

      await AuditLogFactory.createMany(5)

      const repository = await app.container.make(AuditLogsRepository)
      const deletedCount = await repository.cleanupOldLogs(90)

      assert.equal(deletedCount, 1)
    })
  })

  test('findByAction filters by action type', async ({ assert }) => {
    await withTenantContext(async () => {
      await AuditLogFactory.merge({ action: 'create' }).createMany(3)
      await AuditLogFactory.merge({ action: 'delete' }).createMany(2)

      const repository = await app.container.make(AuditLogsRepository)
      const result = await repository.findByAction('create')

      assert.lengthOf(result, 3)
      result.forEach((log: any) => assert.equal(log.action, 'create'))
    })
  })

  test('findByResource filters by resource type', async ({ assert }) => {
    await withTenantContext(async () => {
      await AuditLogFactory.merge({ resource: 'users' }).createMany(4)
      await AuditLogFactory.merge({ resource: 'files' }).createMany(2)

      const repository = await app.container.make(AuditLogsRepository)
      const result = await repository.findByResource('users')

      assert.lengthOf(result, 4)
      result.forEach((log: any) => assert.equal(log.resource, 'users'))
    })
  })

  test('findByResult filters by granted/denied', async ({ assert }) => {
    await withTenantContext(async () => {
      await AuditLogFactory.apply('granted').createMany(6)
      await AuditLogFactory.apply('denied').createMany(4)

      const repository = await app.container.make(AuditLogsRepository)
      const result = await repository.findByResult('granted')

      assert.lengthOf(result, 6)
      result.forEach((log: any) => assert.equal(log.result, 'granted'))
    })
  })

  test('findByIpAddress filters by IP address', async ({ assert }) => {
    await withTenantContext(async () => {
      const testIp = '192.168.1.1'
      await AuditLogFactory.merge({ ip_address: testIp }).createMany(3)
      await AuditLogFactory.createMany(2)

      const repository = await app.container.make(AuditLogsRepository)
      const result = await repository.findByIpAddress(testIp)

      assert.lengthOf(result, 3)
      result.forEach((log: any) => assert.equal(log.ip_address, testIp))
    })
  })

  test('searchLogs paginates results', async ({ assert }) => {
    await withTenantContext(async () => {
      await AuditLogFactory.createMany(15)

      const repository = await app.container.make(AuditLogsRepository)
      const result = await repository.searchLogs({}, 1, 10)

      assert.equal(result.perPage, 10)
      assert.lengthOf(result.all(), 10)
    })
  })

  test('searchLogs filters by multiple criteria', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()
      await AuditLogFactory.merge({
        user_id: user.id,
        resource: 'users',
        action: 'update',
        result: 'granted',
      }).createMany(2)

      await AuditLogFactory.createMany(5)

      const repository = await app.container.make(AuditLogsRepository)
      const result = await repository.searchLogs(
        {
          user_id: user.id,
          resource: 'users',
          action: 'update',
          result: 'granted',
        },
        1,
        10
      )

      assert.lengthOf(result.all(), 2)
    })
  })

  test('searchLogs filters by date range', async ({ assert }) => {
    await withTenantContext(async () => {
      const startDate = DateTime.now().minus({ days: 3 })

      await AuditLogFactory.createMany(5)

      const endDate = DateTime.now().plus({ seconds: 1 })

      const repository = await app.container.make(AuditLogsRepository)
      const result = await repository.searchLogs(
        {
          start_date: startDate,
          end_date: endDate,
        },
        1,
        100
      )

      assert.isAtLeast(result.all().length, 1)
    })
  })
})
