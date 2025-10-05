import { test } from '@japa/runner'
import TenantContextService from '#services/tenants/tenant_context_service'

test.group('TenantContextService', () => {
  test('getCurrentTenantId returns null when no context is set', ({ assert }) => {
    const tenantId = TenantContextService.getCurrentTenantId()
    assert.isNull(tenantId)
  })

  test('getCurrentTenantId returns tenant_id when context is set', ({ assert }) => {
    const testTenantId = '123e4567-e89b-12d3-a456-426614174000'

    const result = TenantContextService.run(
      { tenant_id: testTenantId, tenant: null, user_id: null, tenant_user: null },
      () => {
        return TenantContextService.getCurrentTenantId()
      }
    )

    assert.equal(result, testTenantId)
  })

  test('assertTenantId throws error when no context is set', ({ assert }) => {
    assert.throws(
      () => TenantContextService.assertTenantId(),
      'Tenant context is required but not set'
    )
  })

  test('assertTenantId returns tenant_id when context is set', ({ assert }) => {
    const testTenantId = '123e4567-e89b-12d3-a456-426614174000'

    const result = TenantContextService.run(
      { tenant_id: testTenantId, tenant: null, user_id: null, tenant_user: null },
      () => {
        return TenantContextService.assertTenantId()
      }
    )

    assert.equal(result, testTenantId)
  })

  test('run executes callback within tenant context', ({ assert }) => {
    const testTenantId = '123e4567-e89b-12d3-a456-426614174000'
    const testUserId = 42

    let capturedTenantId: string | null = null
    let capturedUserId: number | null = null

    TenantContextService.run(
      { tenant_id: testTenantId, tenant: null, user_id: testUserId, tenant_user: null },
      () => {
        const context = TenantContextService.getContext()
        capturedTenantId = context?.tenant_id ?? null
        capturedUserId = context?.user_id ?? null
      }
    )

    assert.equal(capturedTenantId, testTenantId)
    assert.equal(capturedUserId, testUserId)
  })

  test('getContext returns null when no context is set', ({ assert }) => {
    const context = TenantContextService.getContext()
    assert.isNull(context)
  })

  test('getContext returns full context when set', ({ assert }) => {
    const testTenantId = '123e4567-e89b-12d3-a456-426614174000'
    const testUserId = 42

    const result = TenantContextService.run(
      { tenant_id: testTenantId, tenant: null, user_id: testUserId, tenant_user: null },
      () => {
        return TenantContextService.getContext()
      }
    )

    assert.isNotNull(result)
    assert.equal(result?.tenant_id, testTenantId)
    assert.equal(result?.user_id, testUserId)
    assert.isNull(result?.tenant)
  })

  test('context is isolated between nested run calls', ({ assert }) => {
    const outerTenantId = '123e4567-e89b-12d3-a456-426614174000'
    const innerTenantId = '987e6543-e21a-98b7-c654-321987654000'

    TenantContextService.run(
      { tenant_id: outerTenantId, tenant: null, user_id: null, tenant_user: null },
      () => {
        const outerContext = TenantContextService.getCurrentTenantId()
        assert.equal(outerContext, outerTenantId)

        TenantContextService.run(
          { tenant_id: innerTenantId, tenant: null, user_id: null, tenant_user: null },
          () => {
            const innerContext = TenantContextService.getCurrentTenantId()
            assert.equal(innerContext, innerTenantId)
          }
        )

        // Should be back to outer context
        const afterInner = TenantContextService.getCurrentTenantId()
        assert.equal(afterInner, outerTenantId)
      }
    )
  })

  test('run returns the callback result', ({ assert }) => {
    const testTenantId = '123e4567-e89b-12d3-a456-426614174000'

    const result = TenantContextService.run(
      { tenant_id: testTenantId, tenant: null, user_id: null, tenant_user: null },
      () => {
        return { success: true, data: 'test' }
      }
    )

    assert.deepEqual(result, { success: true, data: 'test' })
  })

  test('async operations work within context', async ({ assert }) => {
    const testTenantId = '123e4567-e89b-12d3-a456-426614174000'

    const result = await TenantContextService.run(
      { tenant_id: testTenantId, tenant: null, user_id: null, tenant_user: null },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return TenantContextService.getCurrentTenantId()
      }
    )

    assert.equal(result, testTenantId)
  })
})
