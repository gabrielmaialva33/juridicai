import { BaseModel, scope, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import TenantContextService from '#services/tenants/tenant_context_service'

/**
 * TenantAwareModel is a base model that automatically scopes all queries to the current tenant.
 *
 * Features:
 * - Automatically adds tenant_id to WHERE clauses on all queries
 * - Auto-sets tenant_id on create operations
 * - Uses SnakeCaseNamingStrategy by default
 * - Ensures complete tenant isolation
 *
 * Usage:
 * ```ts
 * export default class Client extends TenantAwareModel {
 *   @column()
 *   declare tenant_id: string
 *
 *   // ... other columns
 * }
 * ```
 *
 * IMPORTANT:
 * - All models extending this class MUST have a 'tenant_id' column (UUID)
 * - Do not instantiate this class directly - only extend it in concrete models
 */
export default class TenantAwareModel extends BaseModel {
  static namingStrategy = new SnakeCaseNamingStrategy()
  /**
   * Scope to filter by specific tenant
   *
   * Usage:
   * ```ts
   * const clients = await Client.query().apply((scopes) => scopes.forTenant(tenantId))
   * ```
   */
  static forTenant = scope((query: ModelQueryBuilderContract<any>, tenantId: string) => {
    query.where('tenant_id', tenantId)
  })
  /**
   * Scope to disable automatic tenant filtering
   * USE WITH EXTREME CAUTION - only for admin operations or cross-tenant queries
   *
   * Usage:
   * ```ts
   * const allClients = await Client.query().apply((scopes) => scopes.withoutTenantScope())
   * ```
   */
  static withoutTenantScope = scope((query: ModelQueryBuilderContract<any>) => {
    // Mark query to skip automatic tenant scope in hooks
    ;(query as any)._skipTenantScope = true
  })

  /**
   * Boot method to register hooks programmatically
   * This approach works correctly with abstract classes, unlike decorators
   */
  static boot() {
    if (this.booted) {
      return
    }

    super.boot()

    /**
     * Hook: Auto-set tenant_id before creating a record
     */
    this.before('create', (model: TenantAwareModel) => {
      // Only set if tenant_id is not already set
      if (!(model as any).tenant_id) {
        const tenantId = TenantContextService.assertTenantId()
        ;(model as any).tenant_id = tenantId
      }
    })

    /**
     * Hook: Scope queries to current tenant (for findBy, find, etc.)
     */
    this.before('find', (query: ModelQueryBuilderContract<typeof TenantAwareModel>) => {
      // Skip automatic scoping if explicitly disabled
      if ((query as any)._skipTenantScope) {
        return
      }

      const tenantId = TenantContextService.getCurrentTenantId()
      if (tenantId) {
        query.where('tenant_id', tenantId)
      }
    })

    /**
     * Hook: Scope queries to current tenant (for all, paginate, etc.)
     */
    this.before('fetch', (query: ModelQueryBuilderContract<typeof TenantAwareModel>) => {
      // Skip automatic scoping if explicitly disabled
      if ((query as any)._skipTenantScope) {
        return
      }

      const tenantId = TenantContextService.getCurrentTenantId()
      if (tenantId) {
        query.where('tenant_id', tenantId)
      }
    })
  }
}
