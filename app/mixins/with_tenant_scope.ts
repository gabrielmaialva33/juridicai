import { BaseModel, scope } from '@adonisjs/lucid/orm'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { NormalizeConstructor } from '@adonisjs/core/types/helpers'
import TenantContextService from '#services/tenants/tenant_context_service'

/**
 * Mixin that adds automatic tenant scoping to models.
 *
 * Features:
 * - Automatically sets tenant_id on creation
 * - Automatically filters queries by the current tenant
 * - Provides forTenant() and withoutTenantScope() methods
 *
 * Usage:
 * ```ts
 * import { compose } from '@adonisjs/core/helpers'
 * import { withTenantScope } from '#mixins/with_tenant_scope'
 *
 * const TenantScoped = withTenantScope()
 *
 * export default class Client extends compose(BaseModel, TenantScoped) {
 *   @column()
 *   declare tenant_id: string
 *
 *   // ... rest of model
 * }
 * ```
 */
export function withTenantScope() {
  return <Model extends NormalizeConstructor<typeof BaseModel>>(superclass: Model) => {
    return class TenantScopedModel extends superclass {
      /**
       * The tenant_id column that will be automatically managed
       */
      declare tenant_id: string

      /**
       * Boot method to register hooks for tenant scoping
       */
      static boot() {
        // Prevent double-booting
        if ((this as any).booted) {
          return
        }

        // Call parent boot
        super.boot()

        /**
         * Hook: Auto-set tenant_id before creating a record
         */
        this.before('create', (model: any) => {
          // Only set if tenant_id is not already set
          if (!model.tenant_id) {
            const tenantId = TenantContextService.assertTenantId()
            model.tenant_id = tenantId
          }
        })

        /**
         * Hook: Scope queries to the current tenant (for find, findBy, etc.)
         */
        this.before('find', (query: any) => {
          // Skip automatic scoping if explicitly disabled
          if (query._skipTenantScope) {
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
        this.before('fetch', (query: any) => {
          // Skip automatic scoping if explicitly disabled
          if (query._skipTenantScope) {
            return
          }

          const tenantId = TenantContextService.getCurrentTenantId()
          if (tenantId) {
            query.where('tenant_id', tenantId)
          }
        })
      }

      /**
       * Scope to filter by a specific tenant
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
    }
  }
}
