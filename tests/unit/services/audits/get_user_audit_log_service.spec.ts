import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'

import GetUserAuditLogsService from '#services/audits/get_user_audit_log_service'
import { UserFactory } from '#database/factories/user_factory'
import { AuditLogFactory } from '#database/factories/audit_log_factory'
import User from '#models/user'
import AuditLog from '#models/audit_log'
import { withTenantContext } from '#tests/utils/tenant_context_helper'

test.group('GetUserAuditLogsService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should return logs for specific user', async ({ assert }) => {
    await withTenantContext(async () => {
      const user1 = await UserFactory.create()
      const user2 = await UserFactory.create()

      // Create logs for user1
      await AuditLogFactory.merge({ user_id: user1.id }).createMany(3)
      // Create logs for user2
      await AuditLogFactory.merge({ user_id: user2.id }).createMany(2)

      const service = await app.container.make(GetUserAuditLogsService)
      const result = await service.run(user1.id)

      assert.lengthOf(result, 3)
      result.forEach((log: any) => {
        assert.equal(log.user_id, user1.id)
      })
    })
  })

  test('should respect limit parameter', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()

      // Create 10 logs
      await AuditLogFactory.merge({ user_id: user.id }).createMany(10)

      const service = await app.container.make(GetUserAuditLogsService)
      const result = await service.run(user.id, 5)

      assert.lengthOf(result, 5)
    })
  })

  test('should use default limit of 100', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()

      // Create 50 logs
      await AuditLogFactory.merge({ user_id: user.id }).createMany(50)

      const service = await app.container.make(GetUserAuditLogsService)
      const result = await service.run(user.id)

      assert.lengthOf(result, 50)
    })
  })

  test('should order by created_at desc', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = (await UserFactory.create()) as User

      // Create logs with different timestamps
      const log1 = (await AuditLogFactory.merge({ user_id: user.id }).create()) as AuditLog
      await new Promise((resolve) => setTimeout(resolve, 10))
      const log2 = (await AuditLogFactory.merge({ user_id: user.id }).create()) as AuditLog
      await new Promise((resolve) => setTimeout(resolve, 10))
      const log3 = (await AuditLogFactory.merge({ user_id: user.id }).create()) as AuditLog

      const service = await app.container.make(GetUserAuditLogsService)
      const result = await service.run(user.id)

      assert.lengthOf(result, 3)
      // Most recent first
      assert.equal(result[0].id, log3.id)
      assert.equal(result[1].id, log2.id)
      assert.equal(result[2].id, log1.id)
    })
  })

  test('should return empty array when user has no logs', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()

      const service = await app.container.make(GetUserAuditLogsService)
      const result = await service.run(user.id)

      assert.lengthOf(result, 0)
      assert.isArray(result)
    })
  })

  test('should handle limit larger than available logs', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()

      await AuditLogFactory.merge({ user_id: user.id }).createMany(5)

      const service = await app.container.make(GetUserAuditLogsService)
      const result = await service.run(user.id, 100)

      assert.lengthOf(result, 5)
    })
  })
})
