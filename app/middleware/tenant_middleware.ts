import app from '@adonisjs/core/services/app'
import membershipService from '#modules/tenant/services/membership_service'
import tenantContext from '#shared/helpers/tenant_context'
import type TenantMembership from '#modules/tenant/models/tenant_membership'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

interface TenantMiddlewareOptions {
  optional?: boolean
}

export default class TenantMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: TenantMiddlewareOptions = {}) {
    const tenantId = this.resolveTenantId(ctx)

    if (!tenantId) {
      if (options.optional) {
        return next()
      }

      return ctx.response.status(400).send({
        code: 'E_TENANT_REQUIRED',
        message: 'A tenant context is required for this action.',
      })
    }

    const user = ctx.auth.user

    if (!user) {
      return ctx.response.status(401).send({
        code: 'E_UNAUTHORIZED',
        message: 'Authentication is required before selecting a tenant.',
      })
    }

    const membership = await membershipService.assertUserBelongsToTenant(tenantId, user.id)

    if (!membership) {
      ctx.session.forget('active_tenant_id')

      return ctx.response.status(403).send({
        code: 'E_TENANT_FORBIDDEN',
        message: 'The selected tenant is not available for this user.',
      })
    }

    ctx.tenant = {
      id: tenantId,
      membership,
    }

    return tenantContext.run(
      {
        tenantId,
        requestId: ctx.requestId,
        userId: user.id,
      },
      () => next()
    )
  }

  private resolveTenantId(ctx: HttpContext): string | undefined {
    const sessionTenantId = ctx.session.get('active_tenant_id') as string | undefined

    if (sessionTenantId) {
      return sessionTenantId
    }

    if (app.inProduction) {
      return undefined
    }

    return ctx.request.header('x-tenant-id') || ctx.request.input('tenant_id')
  }
}

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    tenant?: {
      id: string
      membership: TenantMembership
    }
  }
}
