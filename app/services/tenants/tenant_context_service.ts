import { AsyncLocalStorage } from 'node:async_hooks'
import { HttpContext } from '@adonisjs/core/http'
import Tenant from '#models/tenant'
import TenantUser from '#models/tenant_user'

interface TenantContext {
  tenant_id: string
  tenant: Tenant | null
  user_id: number | null
  tenant_user: TenantUser | null
}

/**
 * TenantContextService manages the current tenant context using AsyncLocalStorage.
 * This ensures tenant isolation across async operations in a multi-tenant application.
 */
class TenantContextService {
  private storage: AsyncLocalStorage<TenantContext>

  constructor() {
    this.storage = new AsyncLocalStorage<TenantContext>()
  }

  /**
   * Run a callback within a tenant context
   */
  run<T>(context: TenantContext, callback: () => T): T {
    return this.storage.run(context, callback)
  }

  /**
   * Get the current tenant context
   */
  getContext(): TenantContext | undefined {
    return this.storage.getStore()
  }

  /**
   * Get the current tenant ID
   * First tries AsyncLocalStorage, then falls back to HttpContext header
   */
  getCurrentTenantId(): string | null {
    // Priority 1: AsyncLocalStorage context
    const context = this.getContext()
    if (context?.tenant_id) {
      return context.tenant_id
    }

    // Priority 2: HttpContext header (for HTTP requests outside AsyncLocalStorage)
    try {
      const ctx = HttpContext.getOrFail()
      const headerTenantId = ctx.request.header('x-tenant-id')
      if (headerTenantId) {
        return headerTenantId
      }
    } catch {
      // HttpContext not available (jobs, CLI, etc)
    }

    return null
  }

  /**
   * Get the current tenant
   */
  getCurrentTenant(): Tenant | null {
    const context = this.getContext()
    return context?.tenant ?? null
  }

  /**
   * Get the current user ID in the tenant context
   */
  getCurrentUserId(): number | null {
    const context = this.getContext()
    return context?.user_id ?? null
  }

  /**
   * Get the current tenant user (pivot)
   */
  getCurrentTenantUser(): TenantUser | null {
    const context = this.getContext()
    return context?.tenant_user ?? null
  }

  /**
   * Set the tenant context (used by middleware)
   */
  setContext(context: Partial<TenantContext>): void {
    const currentContext = this.getContext()
    if (!currentContext) {
      throw new Error('Cannot set context outside of run() scope')
    }

    Object.assign(currentContext, context)
  }

  /**
   * Check if we're in a tenant context
   */
  hasContext(): boolean {
    return this.getContext() !== undefined
  }

  /**
   * Assert that we're in a tenant context
   */
  assertContext(): TenantContext {
    const context = this.getContext()
    if (!context) {
      throw new Error('No tenant context available')
    }
    return context
  }

  /**
   * Assert that we have a tenant ID
   */
  assertTenantId(): string {
    const tenantId = this.getCurrentTenantId()
    if (!tenantId) {
      throw new Error('No tenant ID in current context')
    }
    return tenantId
  }
}

// Export singleton instance
export default new TenantContextService()
