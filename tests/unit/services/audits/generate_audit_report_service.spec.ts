import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'

import GenerateAuditReportService from '#services/audits/generate_audit_report_service'
import { UserFactory } from '#database/factories/user_factory'
import { AuditLogFactory } from '#database/factories/audit_log_factory'
import User from '#models/user'
import AuditLog from '#models/audit_log'
import { withTenantContext } from '#tests/utils/tenant_context_helper'

test.group('GenerateAuditReportService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should return statistics by date range', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()
      const startDate = DateTime.now().minus({ days: 7 })
      const endDate = DateTime.now()

      // Create logs within range
      await AuditLogFactory.merge({ user_id: user.id, result: 'granted' }).createMany(3)
      await AuditLogFactory.merge({ user_id: user.id, result: 'denied' }).createMany(2)

      const service = await app.container.make(GenerateAuditReportService)
      const result = await service.run(startDate, endDate)

      assert.exists(result)
      assert.isDefined(result.summary)
      assert.isDefined(result.daily)
      assert.isDefined(result.byAction)
      assert.isDefined(result.byResource)
    })
  })

  test('should return correct structure with summary data', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()
      const startDate = DateTime.now().minus({ days: 1 })
      const endDate = DateTime.now()

      await AuditLogFactory.merge({ user_id: user.id, result: 'granted' }).createMany(5)
      await AuditLogFactory.merge({ user_id: user.id, result: 'denied' }).createMany(3)

      const service = await app.container.make(GenerateAuditReportService)
      const result = await service.run(startDate, endDate)

      assert.isArray(result.summary)
      assert.isArray(result.daily)
      assert.isArray(result.byAction)
      assert.isArray(result.byResource)
    })
  })

  test('should include daily statistics', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()
      const startDate = DateTime.now().minus({ days: 2 })
      const endDate = DateTime.now()

      // Create logs
      await AuditLogFactory.merge({ user_id: user.id }).createMany(3)

      const service = await app.container.make(GenerateAuditReportService)
      const result = await service.run(startDate, endDate)

      assert.isArray(result.daily)
    })
  })

  test('should include statistics by action', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()
      const startDate = DateTime.now().minus({ days: 1 })
      const endDate = DateTime.now()

      await AuditLogFactory.merge({ user_id: user.id, action: 'create' }).createMany(2)
      await AuditLogFactory.merge({ user_id: user.id, action: 'read' }).createMany(3)

      const service = await app.container.make(GenerateAuditReportService)
      const result = await service.run(startDate, endDate)

      assert.isArray(result.byAction)
    })
  })

  test('should include statistics by resource', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()
      const startDate = DateTime.now().minus({ days: 1 })
      const endDate = DateTime.now()

      await AuditLogFactory.merge({ user_id: user.id, resource: 'users' }).createMany(4)
      await AuditLogFactory.merge({ user_id: user.id, resource: 'files' }).createMany(2)

      const service = await app.container.make(GenerateAuditReportService)
      const result = await service.run(startDate, endDate)

      assert.isArray(result.byResource)
    })
  })

  test('should exclude logs outside date range', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = (await UserFactory.create()) as User
      const startDate = DateTime.now().minus({ days: 2 })
      const endDate = DateTime.now().minus({ days: 1 })

      // Create log within range
      const logInRange = (await AuditLogFactory.merge({ user_id: user.id }).create()) as AuditLog
      logInRange.created_at = DateTime.now().minus({ days: 1, hours: 12 })
      await logInRange.save()

      // Create log outside range (today)
      await AuditLogFactory.merge({ user_id: user.id }).create()

      // Create log outside range (old)
      const oldLog = (await AuditLogFactory.merge({ user_id: user.id }).create()) as AuditLog
      oldLog.created_at = DateTime.now().minus({ days: 5 })
      await oldLog.save()

      const service = await app.container.make(GenerateAuditReportService)
      const result = await service.run(startDate, endDate)

      assert.exists(result)
      // Should only count logs within range
      assert.isArray(result.summary)
    })
  })

  test('should handle empty date range', async ({ assert }) => {
    await withTenantContext(async () => {
      const startDate = DateTime.now().minus({ days: 10 })
      const endDate = DateTime.now().minus({ days: 9 })

      const service = await app.container.make(GenerateAuditReportService)
      const result = await service.run(startDate, endDate)

      assert.exists(result)
      assert.isArray(result.summary)
      assert.isArray(result.daily)
      assert.isArray(result.byAction)
      assert.isArray(result.byResource)
    })
  })
})
