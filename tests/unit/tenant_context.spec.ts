import { test } from '@japa/runner'
import RequestIdMiddleware from '#middleware/request_id_middleware'
import TenantMiddleware from '#middleware/tenant_middleware'
import tenantContext from '#shared/helpers/tenant_context'
import { withTenantRls } from '#shared/helpers/with_tenant_rls'
import { TenantFactory } from '#database/factories/tenant_factory'
import { TenantMembershipFactory } from '#database/factories/tenant_membership_factory'
import { UserFactory } from '#database/factories/user_factory'
import type { HttpContext } from '@adonisjs/core/http'

test.group('Tenant context', () => {
  test('assigns request id from header and mirrors it on the response', async ({ assert }) => {
    const headers = new Map<string, string>()
    const ctx = {
      request: {
        header(name: string) {
          return name === 'x-request-id' ? 'request-seed-1' : undefined
        },
      },
      response: {
        header(name: string, value: string) {
          headers.set(name, value)
        },
      },
    } as HttpContext

    await new RequestIdMiddleware().handle(ctx, async () => undefined)

    assert.equal(ctx.requestId, 'request-seed-1')
    assert.equal(headers.get('x-request-id'), 'request-seed-1')
  })

  test('rejects tenant protected actions without an active tenant', async ({ assert }) => {
    const response = createResponseRecorder()
    const ctx = createTenantContext({
      response,
      sessionValues: {},
    })

    await new TenantMiddleware().handle(ctx, async () => {
      throw new Error('next should not run')
    })

    assert.equal(response.statusCode, 400)
    assert.equal(response.body.code, 'E_TENANT_REQUIRED')
  })

  test('sets async tenant context for an authenticated tenant member', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const user = await UserFactory.create()
    const membership = await TenantMembershipFactory.merge({
      tenantId: tenant.id,
      userId: user.id,
    }).create()

    const response = createResponseRecorder()
    const ctx = createTenantContext({
      response,
      user,
      requestId: 'request-seed-2',
      sessionValues: {
        active_tenant_id: tenant.id,
      },
    })

    await new TenantMiddleware().handle(ctx, async () => {
      assert.equal(ctx.tenant?.id, tenant.id)
      assert.equal(tenantContext.requireTenantId(), tenant.id)
      assert.equal(tenantContext.get()?.requestId, 'request-seed-2')
    })

    await membership.delete()
    await tenant.delete()
    await user.delete()
  })

  test('applies tenant setting on the transaction passed to the callback', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await withTenantRls(tenant.id, async (trx) => {
      const queryResult = await trx.rawQuery(
        `select current_setting('app.tenant_id', true) as tenant_id`
      )
      return queryResult.rows[0]?.tenant_id
    })

    assert.equal(result, tenant.id)

    await tenant.delete()
  })
})

function createResponseRecorder() {
  return {
    statusCode: 200,
    body: undefined as any,
    headers: new Map<string, string>(),
    status(statusCode: number) {
      this.statusCode = statusCode
      return this
    },
    send(body: any) {
      this.body = body
      return body
    },
    header(name: string, value: string) {
      this.headers.set(name, value)
    },
  }
}

function createTenantContext(options: {
  response: ReturnType<typeof createResponseRecorder>
  user?: { id: string }
  requestId?: string
  sessionValues: Record<string, string | undefined>
}) {
  return {
    requestId: options.requestId ?? 'request-seed',
    tenant: undefined,
    auth: {
      user: options.user,
    },
    request: {
      header(name: string) {
        return name === 'x-tenant-id' ? options.sessionValues.headerTenantId : undefined
      },
      input(name: string) {
        return name === 'tenant_id' ? options.sessionValues.queryTenantId : undefined
      },
    },
    response: options.response,
    session: {
      get(key: string) {
        return options.sessionValues[key]
      },
      forget(key: string) {
        delete options.sessionValues[key]
      },
    },
  } as unknown as HttpContext
}
