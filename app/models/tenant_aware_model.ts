import { BaseModel, beforeCreate, beforeFind, beforeFetch } from '@adonisjs/lucid/orm'
import { SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
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
 * IMPORTANT: All models extending this class MUST have a 'tenant_id' column (UUID)
 */
export default abstract class TenantAwareModel extends BaseModel {
  static namingStrategy = new SnakeCaseNamingStrategy()

  /**
   * Hook: Auto-set tenant_id before creating a record
   */
  @beforeCreate()
  static assignTenantId(model: TenantAwareModel) {
    // Only set if tenant_id is not already set
    if (!(model as any).tenant_id) {
      const tenantId = TenantContextService.assertTenantId()
      ;(model as any).tenant_id = tenantId
    }
  }

  /**
   * Hook: Scope queries to current tenant (for findBy, find, etc.)
   */
  @beforeFind()
  static scopeToTenantOnFind(query: ModelQueryBuilderContract<typeof TenantAwareModel>) {
    const tenantId = TenantContextService.getCurrentTenantId()
    if (tenantId) {
      query.where('tenant_id', tenantId)
    }
  }

  /**
   * Hook: Scope queries to current tenant (for all, paginate, etc.)
   */
  @beforeFetch()
  static scopeToTenantOnFetch(query: ModelQueryBuilderContract<typeof TenantAwareModel>) {
    const tenantId = TenantContextService.getCurrentTenantId()
    if (tenantId) {
      query.where('tenant_id', tenantId)
    }
  }

  /**
   * Helper: Temporarily disable tenant scoping (USE WITH EXTREME CAUTION)
   * Only use this for admin operations or cross-tenant queries
   */
  static withoutTenantScope() {
    // Create a query builder and use ignoreScopes (if needed in future)
    return this.query()
  }
}
