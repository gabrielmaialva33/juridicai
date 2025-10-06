import { BaseModel, scope } from '@adonisjs/lucid/orm'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { NormalizeConstructor } from '@adonisjs/core/types/helpers'
import TenantContextService from '#services/tenants/tenant_context_service'

/**
 * Configuration options for the tenant scope mixin
 */
export interface TenantScopeOptions {
  /**
   * The column name that stores the tenant identifier
   * @default 'tenant_id'
   */
  tenantColumn?: string

  /**
   * Whether to throw an error when no tenant context is set
   * @default true
   */
  strictMode?: boolean

  /**
   * Whether to automatically set tenant_id on create
   * @default true
   */
  autoSetOnCreate?: boolean

  /**
   * Whether to automatically filter queries by tenant
   * @default true
   */
  autoFilter?: boolean

  /**
   * Custom tenant resolver function
   * @default Uses TenantContextService
   */
  tenantResolver?: () => string | null
}

/**
 * Type for models that have tenant scope
 */
type TenantScopedRow = {
  tenant_id: string
  ensureTenantContext(): void
  belongsToTenant(tenantId: string): boolean
}

/**
 * Type for the tenant-scoped model class
 */
type TenantScopedModel<
  Model extends NormalizeConstructor<typeof BaseModel> = NormalizeConstructor<typeof BaseModel>,
> = Model & {
  forTenant(tenantId: string): ReturnType<Model['query']>
  withoutTenantScope(): ReturnType<Model['query']>
  currentTenant(): ReturnType<Model['query']>
  crossTenant(): ReturnType<Model['query']>
  tenantColumn: string
  new (...args: any[]): TenantScopedRow
}

/**
 * Advanced Tenant Scope Mixin for AdonisJS v6 (2025 Edition)
 *
 * Features:
 * - 🔒 Automatic tenant isolation with row-level security
 * - ⚙️ Configurable options for flexibility
 * - 🎯 Type-safe implementation with full TypeScript support
 * - 🚀 Performance optimized with minimal overhead
 * - 🛡️ Security-first design with strict mode
 * - 🔧 Multiple utility methods for tenant operations
 *
 * @example
 * ```ts
 * import { compose } from '@adonisjs/core/helpers'
 * import { BaseModel } from '@adonisjs/lucid/orm'
 * import { withTenantScope } from '#mixins/with_tenant_scope'
 *
 * // Basic usage
 * const TenantScoped = withTenantScope()
 *
 * // With custom options
 * const TenantScoped = withTenantScope({
 *   tenantColumn: 'organization_id',
 *   strictMode: true,
 *   autoFilter: true
 * })
 *
 * export default class Client extends compose(BaseModel, TenantScoped) {
 *   @column()
 *   declare tenant_id: string // or organization_id if customized
 *
 *   // Your model columns...
 * }
 * ```
 */
export function withTenantScope(options: TenantScopeOptions = {}) {
  // Default options
  const config = {
    tenantColumn: 'tenant_id',
    strictMode: true,
    autoSetOnCreate: true,
    autoFilter: true,
    tenantResolver: () => TenantContextService.getCurrentTenantId(),
    ...options,
  }

  return <Model extends NormalizeConstructor<typeof BaseModel>>(
    superclass: Model
  ): TenantScopedModel<Model> => {
    class TenantScopedModelClass extends superclass {
      /**
       * The tenant column name for this model
       */
      static tenantColumn = config.tenantColumn

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
        if (config.autoSetOnCreate) {
          this.before('create', (model: any) => {
            const columnName = config.tenantColumn

            // Only set if tenant column is not already set
            if (!model[columnName]) {
              const tenantId =
                config.tenantResolver?.() || TenantContextService.getCurrentTenantId()

              if (!tenantId && config.strictMode) {
                // Keep backward compatibility with existing tests
                throw new Error('No tenant ID in current context')
              }

              if (tenantId) {
                model[columnName] = tenantId
              }
            }
          })
        }

        /**
         * Hook: Scope queries to the current tenant (for find, findBy, first, etc.)
         */
        if (config.autoFilter) {
          this.before('find', (query: any) => {
            // Skip automatic scoping if explicitly disabled
            if (query._skipTenantScope) {
              return
            }

            const tenantId = config.tenantResolver?.() || TenantContextService.getCurrentTenantId()
            if (tenantId) {
              query.where(config.tenantColumn, tenantId)
            } else if (config.strictMode && !query._allowCrossTenant) {
              // In strict mode, queries without tenant context should fail
              throw new Error(
                `Cannot query ${this.name} without tenant context. ` +
                  `Use .crossTenant() or .withoutTenantScope() to explicitly allow cross-tenant queries.`
              )
            }
          })

          /**
           * Hook: Scope queries to the current tenant (for all, paginate, etc.)
           */
          this.before('fetch', (query: any) => {
            // Skip automatic scoping if explicitly disabled
            if (query._skipTenantScope) {
              return
            }

            const tenantId = config.tenantResolver?.() || TenantContextService.getCurrentTenantId()
            if (tenantId) {
              query.where(config.tenantColumn, tenantId)
            } else if (config.strictMode && !query._allowCrossTenant) {
              throw new Error(
                `Cannot query ${this.name} without tenant context. ` +
                  `Use .crossTenant() or .withoutTenantScope() to explicitly allow cross-tenant queries.`
              )
            }
          })

          /**
           * Hook: Validate tenant context on updates
           */
          this.before('update', (model: any) => {
            const columnName = config.tenantColumn
            const currentTenant =
              config.tenantResolver?.() || TenantContextService.getCurrentTenantId()

            if (currentTenant && model[columnName] && model[columnName] !== currentTenant) {
              if (config.strictMode) {
                throw new Error(
                  `Cannot update ${this.constructor.name} from different tenant. ` +
                    `Current tenant: ${currentTenant}, Model tenant: ${model[columnName]}`
                )
              }
            }
          })

          /**
           * Hook: Validate tenant context on deletes
           */
          this.before('delete', (model: any) => {
            const columnName = config.tenantColumn
            const currentTenant =
              config.tenantResolver?.() || TenantContextService.getCurrentTenantId()

            if (currentTenant && model[columnName] && model[columnName] !== currentTenant) {
              if (config.strictMode) {
                throw new Error(
                  `Cannot delete ${this.constructor.name} from different tenant. ` +
                    `Current tenant: ${currentTenant}, Model tenant: ${model[columnName]}`
                )
              }
            }
          })
        }
      }

      /**
       * Instance method: Ensure the model has tenant context
       */
      ensureTenantContext(): void {
        const columnName = config.tenantColumn
        if (!this[columnName as keyof this]) {
          throw new Error(`${this.constructor.name} instance is missing tenant context`)
        }
      }

      /**
       * Instance method: Check if model belongs to a specific tenant
       */
      belongsToTenant(tenantId: string): boolean {
        const columnName = config.tenantColumn
        return this[columnName as keyof this] === tenantId
      }

      /**
       * Static method: Query for a specific tenant
       *
       * @example
       * ```ts
       * const clients = await Client.forTenant('tenant-uuid').all()
       * ```
       */
      static forTenant(tenantId: string) {
        return this.query().where(config.tenantColumn, tenantId)
      }

      /**
       * Static method: Query without tenant scope (admin operations)
       * USE WITH EXTREME CAUTION
       *
       * @example
       * ```ts
       * const allClients = await Client.withoutTenantScope().all()
       * ```
       */
      static withoutTenantScope() {
        const query = this.query()
        ;(query as any)._skipTenantScope = true
        return query
      }

      /**
       * Static method: Query for the current tenant (explicit)
       *
       * @example
       * ```ts
       * const clients = await Client.currentTenant().all()
       * ```
       */
      static currentTenant() {
        const tenantId = config.tenantResolver?.() || TenantContextService.getCurrentTenantId()

        if (!tenantId) {
          throw new Error('No tenant context available')
        }

        return this.query().where(config.tenantColumn, tenantId)
      }

      /**
       * Static method: Allow cross-tenant queries (less strict than withoutTenantScope)
       *
       * @example
       * ```ts
       * const clients = await Client.crossTenant()
       *   .whereIn('tenant_id', ['tenant1', 'tenant2'])
       *   .all()
       * ```
       */
      static crossTenant() {
        const query = this.query()
        ;(query as any)._allowCrossTenant = true
        return query
      }

      /**
       * Scope: Filter by specific tenant (chainable)
       *
       * @example
       * ```ts
       * const clients = await Client.query()
       *   .apply((scopes) => scopes.forTenant(tenantId))
       * ```
       */
      static forTenantScope = scope((query: ModelQueryBuilderContract<any>, tenantId: string) => {
        query.where(config.tenantColumn, tenantId)
      })

      /**
       * Scope: Disable automatic tenant filtering (chainable)
       * USE WITH EXTREME CAUTION
       *
       * @example
       * ```ts
       * const allClients = await Client.query()
       *   .apply((scopes) => scopes.withoutTenantScope())
       * ```
       */
      static withoutTenantScopeScope = scope((query: ModelQueryBuilderContract<any>) => {
        ;(query as any)._skipTenantScope = true
      })

      /**
       * Scope: Filter by multiple tenants
       *
       * @example
       * ```ts
       * const clients = await Client.query()
       *   .apply((scopes) => scopes.forTenants(['tenant1', 'tenant2']))
       * ```
       */
      static forTenants = scope((query: ModelQueryBuilderContract<any>, tenantIds: string[]) => {
        query.whereIn(config.tenantColumn, tenantIds)
      })

      /**
       * Scope: Exclude specific tenants
       *
       * @example
       * ```ts
       * const clients = await Client.query()
       *   .apply((scopes) => scopes.excludeTenants(['competitor1', 'competitor2']))
       * ```
       */
      static excludeTenants = scope(
        (query: ModelQueryBuilderContract<any>, tenantIds: string[]) => {
          query.whereNotIn(config.tenantColumn, tenantIds)
        }
      )
    }

    return TenantScopedModelClass as any
  }
}

/**
 * Convenience export for basic usage without options
 */
export const TenantScoped = withTenantScope()
