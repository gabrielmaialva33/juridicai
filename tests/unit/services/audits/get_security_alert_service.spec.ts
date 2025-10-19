import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'

import GetSecurityAlertsService from '#services/audits/get_security_alert_service'
import { UserFactory } from '#database/factories/user_factory'
import { AuditLogFactory } from '#database/factories/audit_log_factory'
import User from '#models/user'
import AuditLog from '#models/audit_log'
import { withTenantContext } from '#tests/utils/tenant_context_helper'

test.group('GetSecurityAlertsService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should return only denied logs', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()

      // Create granted logs
      await AuditLogFactory.merge({
        user_id: user.id,
        result: 'granted',
      }).createMany(3)
      // Create denied logs
      await AuditLogFactory.merge({
        user_id: user.id,
        result: 'denied',
      }).createMany(2)

      const service = await app.container.make(GetSecurityAlertsService)
      const result = await service.run()

      assert.lengthOf(result, 2)
      result.forEach((log: any) => {
        assert.equal(log.result, 'denied')
      })
    })
  })

  test('should filter by days parameter', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create() as User

      // Create recent denied log (within 7 days)
      await AuditLogFactory.merge({
        user_id: user.id,
        result: 'denied',
      }).create()

      // Create old denied log (older than 7 days)
      const oldLog = await AuditLogFactory.merge({
        user_id: user.id,
        result: 'denied',
      }).create() as AuditLog

      // Manually update the created_at to be 10 days ago
      oldLog.created_at = DateTime.now().minus({ days: 10 })
      await oldLog.save()

      const service = await app.container.make(GetSecurityAlertsService)
      const result = await service.run(7)

      assert.lengthOf(result, 1)
      assert.notEqual(result[0].id, oldLog.id)
    })
  })

  test('should use default of 7 days', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create() as User

      // Create recent denied log
      await AuditLogFactory.merge({
        user_id: user.id,
        result: 'denied',
      }).create()

      // Create old denied log
      const oldLog = await AuditLogFactory.merge({
        user_id: user.id,
        result: 'denied',
      }).create() as AuditLog

      oldLog.created_at = DateTime.now().minus({ days: 8 })
      await oldLog.save()

      const service = await app.container.make(GetSecurityAlertsService)
      const result = await service.run()

      assert.lengthOf(result, 1)
    })
  })

  test('should return empty array when no alerts', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()

      // Create only granted logs
      await AuditLogFactory.merge({ user_id: user.id, result: 'granted' }).createMany(5)

      const service = await app.container.make(GetSecurityAlertsService)
      const result = await service.run()

      assert.lengthOf(result, 0)
      assert.isArray(result)
    })
  })

  test('should return all denied logs within custom days range', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create() as User

      // Create denied logs at different times
      await AuditLogFactory.merge({
        user_id: user.id,
        result: 'denied',
      }).create() // Today

      const log2 = await AuditLogFactory.merge({
        user_id: user.id,
        result: 'denied',
      }).create() as AuditLog
      log2.created_at = DateTime.now().minus({ days: 5 })
      await log2.save()

      const log3 = await AuditLogFactory.merge({
        user_id: user.id,
        result: 'denied',
      }).create() as AuditLog
      log3.created_at = DateTime.now().minus({ days: 15 })
      await log3.save()

      const service = await app.container.make(GetSecurityAlertsService)
      const result = await service.run(30)

      assert.lengthOf(result, 3)
    })
  })

  test('should order results by created_at desc', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create() as User

      const log1 = await AuditLogFactory.merge({
        user_id: user.id,
        result: 'denied',
      }).create() as AuditLog
      log1.created_at = DateTime.now().minus({ days: 3 })
      await log1.save()

      await new Promise((resolve) => setTimeout(resolve, 10))

      const log2 = await AuditLogFactory.merge({
        user_id: user.id,
        result: 'denied',
      }).create() as AuditLog
      log2.created_at = DateTime.now().minus({ days: 1 })
      await log2.save()

      const service = await app.container.make(GetSecurityAlertsService)
      const result = await service.run()

      assert.lengthOf(result, 2)
      // Most recent first
      assert.equal(result[0].id, log2.id)
      assert.equal(result[1].id, log1.id)
    })
  })
})
