import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'

import LogPermissionCheckService from '#services/audits/log_permission_check_service'
import { UserFactory } from '#database/factories/user_factory'

test.group('LogPermissionCheckService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should create audit log with permission check data', async ({ assert }) => {
    const user = await UserFactory.create()

    const service = await app.container.make(LogPermissionCheckService)
    const result = await service.run({
      user_id: user.id,
      resource: 'users',
      action: 'read',
      result: 'granted',
    })

    assert.exists(result)
    assert.equal(result.user_id, user.id)
    assert.equal(result.resource, 'users')
    assert.equal(result.action, 'read')
    assert.equal(result.result, 'granted')
  })

  test('should sanitize sensitive data from request', async ({ assert }) => {
    const ctx = await testUtils.createHttpContext()
    ctx.request.updateBody({
      username: 'test',
      password: 'secret123',
      token: 'bearer-token',
      email: 'test@example.com',
    })

    const service = await app.container.make(LogPermissionCheckService)
    const result = await service.run(
      {
        resource: 'users',
        action: 'create',
        result: 'granted',
      },
      ctx
    )

    assert.exists(result.request_data)
    assert.equal(result.request_data!.password, '[REDACTED]')
    assert.equal(result.request_data!.token, '[REDACTED]')
    assert.equal(result.request_data!.username, 'test')
    assert.equal(result.request_data!.email, 'test@example.com')
  })

  test('should handle optional HttpContext', async ({ assert }) => {
    const service = await app.container.make(LogPermissionCheckService)
    const result = await service.run({
      resource: 'files',
      action: 'delete',
      result: 'denied',
      reason: 'Insufficient permissions',
    })

    assert.exists(result)
    assert.equal(result.resource, 'files')
    assert.equal(result.action, 'delete')
    assert.equal(result.result, 'denied')
    assert.equal(result.reason, 'Insufficient permissions')
    // When no context is provided, these fields are null
    assert.isUndefined(result.ip_address)
    assert.isUndefined(result.user_agent)
  })

  test('should store IP, user agent, URL when context provided', async ({ assert }) => {
    const ctx = await testUtils.createHttpContext()
    ctx.request.request.headers['user-agent'] = 'Mozilla/5.0 Test Browser'

    const service = await app.container.make(LogPermissionCheckService)
    const result = await service.run(
      {
        resource: 'permissions',
        action: 'update',
        result: 'granted',
      },
      ctx
    )

    assert.exists(result)
    // Check that request context fields are captured
    assert.property(result, 'ip_address')
    assert.property(result, 'user_agent')
    assert.property(result, 'method')
    assert.property(result, 'url')
    // User agent should be set from the header
    assert.equal(result.user_agent, 'Mozilla/5.0 Test Browser')
  })

  test('should handle all optional fields', async ({ assert }) => {
    const user = await UserFactory.create()
    const ctx = await testUtils.createHttpContext()

    const service = await app.container.make(LogPermissionCheckService)
    const result = await service.run(
      {
        user_id: user.id,
        session_id: 'session-123',
        resource: 'tenants',
        action: 'create',
        context: 'own',
        resource_id: 42,
        result: 'granted',
        reason: 'User has permission',
        metadata: { key: 'value' },
      },
      ctx
    )

    assert.exists(result)
    assert.equal(result.user_id, user.id)
    assert.equal(result.session_id, 'session-123')
    assert.equal(result.resource, 'tenants')
    assert.equal(result.action, 'create')
    assert.equal(result.context, 'own')
    assert.equal(result.resource_id, 42)
    assert.equal(result.result, 'granted')
    assert.equal(result.reason, 'User has permission')
    assert.deepEqual(result.metadata, { key: 'value' })
  })

  test('should redact multiple sensitive fields', async ({ assert }) => {
    const ctx = await testUtils.createHttpContext()
    ctx.request.updateBody({
      user_password: 'secret',
      api_key: 'key123',
      secret_token: 'token456',
      authorization: 'Bearer xyz',
      cookie: 'session=abc',
      normal_field: 'value',
    })

    const service = await app.container.make(LogPermissionCheckService)
    const result = await service.run(
      {
        resource: 'auth',
        action: 'login',
        result: 'granted',
      },
      ctx
    )

    assert.exists(result.request_data)
    assert.equal(result.request_data!.user_password, '[REDACTED]')
    assert.equal(result.request_data!.api_key, '[REDACTED]')
    assert.equal(result.request_data!.secret_token, '[REDACTED]')
    assert.equal(result.request_data!.authorization, '[REDACTED]')
    assert.equal(result.request_data!.cookie, '[REDACTED]')
    assert.equal(result.request_data!.normal_field, 'value')
  })
})
