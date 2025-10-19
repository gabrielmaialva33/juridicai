import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import User from '#models/user'
import TenantContextService from '#services/tenants/tenant_context_service'
import Tenant from '#models/tenant'
import TenantUser from '#models/tenant_user'

/**
 * TenantResolverMiddleware extracts the tenant from the request and sets up the tenant context.
 *
 * Tenant resolution strategies (in order):
 * 1. X-Tenant-ID header (for API calls)
 * 2. Subdomain extraction (e.g., acme.juridicai.com.br -> subdomain: acme)
 * 3. User's default tenant (if authenticated and no tenant specified)
 *
 * After resolving, it loads the Tenant and TenantUser and runs the request within TenantContext.
 */
export default class TenantResolverMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const tenantId = await this.resolveTenantId(ctx)

    if (!tenantId) {
      return ctx.response.unauthorized({
        message: 'Tenant not specified. Please provide X-Tenant-ID header or use tenant subdomain.',
      })
    }

    // Load tenant
    const tenant = await Tenant.query().where('id', tenantId).where('is_active', true).first()

    if (!tenant) {
      return ctx.response.notFound({
        message: 'Tenant not found or inactive',
      })
    }

    // Load tenant user if authenticated
    let tenantUser: TenantUser | null = null
    if (ctx.auth.user) {
      tenantUser = await TenantUser.query()
        .where('tenant_id', tenantId)
        .where('user_id', (ctx.auth.user as unknown as User).id)
        .where('is_active', true)
        .first()

      if (!tenantUser) {
        return ctx.response.forbidden({
          message: 'You do not have access to this tenant',
        })
      }
    }

    // Run request within tenant context
    return TenantContextService.run(
      {
        tenant_id: tenantId,
        tenant: tenant,
        user_id: (ctx.auth.user as unknown as User | null)?.id ?? null,
        tenant_user: tenantUser,
      },
      async () => {
        // Make tenant available on HTTP context for convenience
        ctx.tenant = tenant
        ctx.tenant_user = tenantUser

        const output = await next()
        return output
      }
    )
  }

  /**
   * Resolve tenant ID from request
   */
  private async resolveTenantId(ctx: HttpContext): Promise<string | null> {
    // Strategy 1: X-Tenant-ID header
    const headerTenantId = ctx.request.header('X-Tenant-ID')
    if (headerTenantId) {
      return headerTenantId
    }

    // Strategy 2: Subdomain extraction
    const subdomain = this.extractSubdomain(ctx)
    if (subdomain) {
      const tenant = await Tenant.query().where('subdomain', subdomain).first()
      if (tenant) {
        return tenant.id
      }
    }

    // Strategy 3: User's first active tenant (fallback)
    if (ctx.auth.user) {
      const tenantUser = await TenantUser.query()
        .where('user_id', (ctx.auth.user as unknown as User).id)
        .where('is_active', true)
        .preload('tenant')
        .first()

      if (tenantUser?.tenant.is_active) {
        return tenantUser.tenant_id
      }
    }

    return null
  }

  /**
   * Extract subdomain from hostname
   * Example: acme.juridicai.com.br -> acme
   */
  private extractSubdomain(ctx: HttpContext): string | null {
    const hostname = ctx.request.hostname()
    if (!hostname) return null

    // Split hostname and check if there's a subdomain
    const parts = hostname.split('.')

    // For localhost development, check if it's like tenant.localhost
    if (hostname.includes('localhost') && parts.length > 1) {
      return parts[0]
    }

    // For production, expect format: subdomain.juridicai.com.br (minimum 3 parts)
    if (parts.length >= 3) {
      return parts[0]
    }

    return null
  }
}

// Extend HttpContext type to include tenant
declare module '@adonisjs/core/http' {
  interface HttpContext {
    tenant?: Tenant
    tenant_user?: TenantUser | null
  }
}
