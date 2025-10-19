import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'

import LogUserActionService from '#services/audits/log_user_action_service'
import { UserFactory } from '#database/factories/user_factory'
import { withTenantContext } from '#tests/utils/tenant_context_helper'

test.group('LogUserActionService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should create audit log with user action data', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()

      const service = await app.container.make(LogUserActionService)
      const result = await service.run({
        user_id: user.id,
        action: 'create',
        resource: 'files',
      })

      assert.exists(result)
      assert.equal(result.user_id, user.id)
      assert.equal(result.action, 'create')
      assert.equal(result.resource, 'files')
    })
  })

  test('should set default status to granted when not provided', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()

      const service = await app.container.make(LogUserActionService)
      const result = await service.run({
        user_id: user.id,
        action: 'read',
        resource: 'users',
      })

      assert.exists(result)
      assert.equal(result.result, 'granted')
    })
  })

  test('should handle all optional fields', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()

      const service = await app.container.make(LogUserActionService)
      const result = await service.run({
        user_id: user.id,
        action: 'delete',
        resource: 'documents',
        resource_id: 123,
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        metadata: { reason: 'cleanup', batch: true },
        status: 'denied',
      })

      assert.exists(result)
      assert.equal(result.user_id, user.id)
      assert.equal(result.action, 'delete')
      assert.equal(result.resource, 'documents')
      assert.equal(result.resource_id, 123)
      assert.equal(result.ip_address, '192.168.1.1')
      assert.equal(result.user_agent, 'Mozilla/5.0')
      assert.deepEqual(result.metadata, { reason: 'cleanup', batch: true })
      assert.equal(result.result, 'denied')
    })
  })

  test('should handle missing optional fields', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()

      const service = await app.container.make(LogUserActionService)
      const result = await service.run({
        user_id: user.id,
        action: 'update',
        resource: 'tenants',
      })

      assert.exists(result)
      assert.equal(result.user_id, user.id)
      assert.equal(result.action, 'update')
      assert.equal(result.resource, 'tenants')
      assert.isNull(result.resource_id)
      assert.isNull(result.ip_address)
      assert.isNull(result.user_agent)
      assert.isNull(result.metadata)
      assert.equal(result.result, 'granted')
    })
  })

  test('should accept denied status', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()

      const service = await app.container.make(LogUserActionService)
      const result = await service.run({
        user_id: user.id,
        action: 'delete',
        resource: 'cases',
        status: 'denied',
      })

      assert.exists(result)
      assert.equal(result.result, 'denied')
    })
  })

  test('should store metadata as JSON', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()

      const metadata = {
        previous_value: 'old',
        new_value: 'new',
        changed_fields: ['name', 'email'],
        automated: false,
      }

      const service = await app.container.make(LogUserActionService)
      const result = await service.run({
        user_id: user.id,
        action: 'update',
        resource: 'clients',
        metadata: metadata,
      })

      assert.exists(result)
      assert.deepEqual(result.metadata, metadata)
    })
  })

  test('should handle complex metadata objects', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()

      const complexMetadata = {
        filters: {
          status: 'active',
          type: ['individual', 'corporate'],
        },
        pagination: {
          page: 1,
          limit: 50,
        },
        sort: {
          field: 'created_at',
          direction: 'desc',
        },
      }

      const service = await app.container.make(LogUserActionService)
      const result = await service.run({
        user_id: user.id,
        action: 'list',
        resource: 'cases',
        metadata: complexMetadata,
      })

      assert.exists(result)
      assert.deepEqual(result.metadata, complexMetadata)
    })
  })

  test('should store resource_id when provided', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()

      const service = await app.container.make(LogUserActionService)
      const result = await service.run({
        user_id: user.id,
        action: 'read',
        resource: 'files',
        resource_id: 456,
      })

      assert.exists(result)
      assert.equal(result.resource_id, 456)
    })
  })

  test('should capture IP and user agent when provided', async ({ assert }) => {
    await withTenantContext(async () => {
      const user = await UserFactory.create()

      const service = await app.container.make(LogUserActionService)
      const result = await service.run({
        user_id: user.id,
        action: 'create',
        resource: 'permissions',
        ip_address: '10.0.0.1',
        user_agent: 'PostmanRuntime/7.29.0',
      })

      assert.exists(result)
      assert.equal(result.ip_address, '10.0.0.1')
      assert.equal(result.user_agent, 'PostmanRuntime/7.29.0')
    })
  })
})
