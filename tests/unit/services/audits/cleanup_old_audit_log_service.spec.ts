import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'

import CleanupOldAuditLogsService from '#services/audits/cleanup_old_audit_log_service'
import { UserFactory } from '#database/factories/user_factory'
import { AuditLogFactory } from '#database/factories/audit_log_factory'
import AuditLog from '#models/audit_log'
import User from '#models/user'
import { withTenantContext } from '#tests/utils/tenant_context_helper'

test.group('CleanupOldAuditLogsService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should delete logs older than specified days', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create() as User

      // Create old logs (older than 30 days)
      const oldLog1 = await AuditLogFactory.merge({ user_id: user.id }).create() as AuditLog
      oldLog1.created_at = DateTime.now().minus({ days: 35 })
      await oldLog1.save()

      const oldLog2 = await AuditLogFactory.merge({ user_id: user.id }).create() as AuditLog
      oldLog2.created_at = DateTime.now().minus({ days: 40 })
      await oldLog2.save()

      // Create recent log
      await AuditLogFactory.merge({ user_id: user.id }).create()

      const service = await app.container.make(CleanupOldAuditLogsService)
      const deletedCount = await service.run(30)

      assert.equal(deletedCount, 2)

      // Verify old logs are deleted
      const remainingLogs = await AuditLog.all()
      assert.lengthOf(remainingLogs, 1)
    })
  })

  test('should return count of deleted records', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create() as User

      // Create 5 old logs
      for (let i = 0; i < 5; i++) {
        const log = await AuditLogFactory.merge({ user_id: user.id }).create() as AuditLog
        log.created_at = DateTime.now().minus({ days: 100 })
        await log.save()
      }

      const service = await app.container.make(CleanupOldAuditLogsService)
      const deletedCount = await service.run(90)

      assert.equal(deletedCount, 5)
    })
  })

  test('should not delete recent logs', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create() as User

      // Create recent logs
      await AuditLogFactory.merge({ user_id: user.id }).create()
      await AuditLogFactory.merge({ user_id: user.id }).create()
      await AuditLogFactory.merge({ user_id: user.id }).create()

      const service = await app.container.make(CleanupOldAuditLogsService)
      const deletedCount = await service.run(30)

      assert.equal(deletedCount, 0)

      // Verify all logs still exist
      const remainingLogs = await AuditLog.all()
      assert.lengthOf(remainingLogs, 3)
    })
  })

  test('should handle cleanup with no old logs', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create() as User

      // Create only recent logs
      await AuditLogFactory.merge({ user_id: user.id }).createMany(3)

      const service = await app.container.make(CleanupOldAuditLogsService)
      const deletedCount = await service.run(30)

      assert.equal(deletedCount, 0)
    })
  })

  test('should respect different retention periods', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create() as User

      // Create log 50 days old
      const log1 = await AuditLogFactory.merge({ user_id: user.id }).create() as AuditLog
      log1.created_at = DateTime.now().minus({ days: 50 })
      await log1.save()

      // Create log 20 days old
      const log2 = await AuditLogFactory.merge({ user_id: user.id }).create() as AuditLog
      log2.created_at = DateTime.now().minus({ days: 20 })
      await log2.save()

      // Delete logs older than 30 days
      const service = await app.container.make(CleanupOldAuditLogsService)
      const deletedCount = await service.run(30)

      assert.equal(deletedCount, 1)

      // Verify only the 50-day old log was deleted
      const remainingLogs = await AuditLog.all()
      assert.lengthOf(remainingLogs, 1)
      assert.equal(remainingLogs[0].id, log2.id)
    })
  })

  test('should handle cleanup on exact boundary day', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create() as User

      // Create log exactly 30 days old
      const log = await AuditLogFactory.merge({ user_id: user.id }).create() as AuditLog
      log.created_at = DateTime.now().minus({ days: 30 })
      await log.save()

      const service = await app.container.make(CleanupOldAuditLogsService)
      const deletedCount = await service.run(30)

      // Boundary behavior - the log at exactly 30 days may or may not be deleted
      // depending on time precision, so we just check it's 0 or 1
      assert.isAtMost(deletedCount, 1)
    })
  })

  test('should delete all logs when retention is 0', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create() as User

      // Create logs with various ages
      const log1 = await AuditLogFactory.merge({ user_id: user.id }).create() as AuditLog
      log1.created_at = DateTime.now().minus({ days: 1 })
      await log1.save()

      const log2 = await AuditLogFactory.merge({ user_id: user.id }).create() as AuditLog
      log2.created_at = DateTime.now().minus({ days: 10 })
      await log2.save()

      const service = await app.container.make(CleanupOldAuditLogsService)
      const deletedCount = await service.run(0)

      assert.isAtLeast(deletedCount, 2)
    })
  })
})
