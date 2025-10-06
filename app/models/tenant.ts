import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, scope, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import TenantUser from '#models/tenant_user'

type TenantPlan = 'free' | 'starter' | 'pro' | 'enterprise'

interface TenantLimits {
  max_users?: number
  max_cases?: number
  max_storage_gb?: number
  max_documents?: number

  [key: string]: any
}

export default class Tenant extends BaseModel {
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare subdomain: string

  @column()
  declare custom_domain: string | null

  @column()
  declare plan: TenantPlan

  @column()
  declare is_active: boolean

  @column({
    prepare: (value: TenantLimits | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | null) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare limits: TenantLimits | null

  @column.dateTime()
  declare trial_ends_at: DateTime | null

  @column.dateTime()
  declare suspended_at: DateTime | null

  @column()
  declare suspended_reason: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // Relationships
  @hasMany(() => TenantUser, {
    foreignKey: 'tenant_id',
  })
  declare tenant_users: HasMany<typeof TenantUser>

  /**
   * ------------------------------------------------------
   * Query Scopes
   * ------------------------------------------------------
   */

  /**
   * Filter active tenants
   * @example Tenant.query().withScopes(s => s.active())
   */
  static active = scope((query) => {
    query.where('is_active', true)
  })

  /**
   * Filter tenants by plan
   * @example Tenant.query().withScopes(s => s.byPlan('pro'))
   */
  static byPlan = scope((query, plan: TenantPlan) => {
    query.where('plan', plan)
  })

  /**
   * Filter tenants by multiple plans
   * @example Tenant.query().withScopes(s => s.byPlans(['pro', 'enterprise']))
   */
  static byPlans = scope((query, plans: TenantPlan[]) => {
    query.whereIn('plan', plans)
  })

  /**
   * Find tenant by subdomain
   * @example Tenant.query().withScopes(s => s.bySubdomain('acme'))
   */
  static bySubdomain = scope((query, subdomain: string) => {
    query.where('subdomain', subdomain)
  })

  /**
   * Find tenant by custom domain
   * @example Tenant.query().withScopes(s => s.byCustomDomain('acme.com'))
   */
  static byCustomDomain = scope((query, domain: string) => {
    query.where('custom_domain', domain)
  })

  /**
   * Search tenants by name or subdomain
   * @example Tenant.query().withScopes(s => s.search('acme'))
   */
  static search = scope((query, term: string) => {
    if (!term || !term.trim()) return

    const searchTerm = `%${term.trim()}%`
    query.where((builder) => {
      builder
        .whereILike('name', searchTerm)
        .orWhereILike('subdomain', searchTerm)
        .orWhereILike('custom_domain', searchTerm)
    })
  })

  /**
   * Include tenant limits in response
   * @example Tenant.query().withScopes(s => s.withLimits())
   */
  static withLimits = scope((query) => {
    query.select('*', 'limits')
  })

  /**
   * Filter tenants near their limits
   * @example Tenant.query().withScopes(s => s.nearLimits(0.8))
   */
  static nearLimits = scope((query, threshold = 0.8) => {
    // This would require a more complex query based on actual usage
    // For now, just filter tenants with limits set
    query.whereNotNull('limits')
  })

  /**
   * Filter suspended tenants
   * @example Tenant.query().withScopes(s => s.suspended())
   */
  static suspended = scope((query) => {
    query.whereNotNull('suspended_at')
  })

  /**
   * Filter non-suspended tenants
   * @example Tenant.query().withScopes(s => s.notSuspended())
   */
  static notSuspended = scope((query) => {
    query.whereNull('suspended_at')
  })

  /**
   * Filter tenants in trial
   * @example Tenant.query().withScopes(s => s.inTrial())
   */
  static inTrial = scope((query) => {
    query.whereNotNull('trial_ends_at').where('trial_ends_at', '>', DateTime.now().toSQL())
  })

  /**
   * Filter tenants with expired trial
   * @example Tenant.query().withScopes(s => s.trialExpired())
   */
  static trialExpired = scope((query) => {
    query.whereNotNull('trial_ends_at').where('trial_ends_at', '<=', DateTime.now().toSQL())
  })

  /**
   * Include tenant users count
   * @example Tenant.query().withScopes(s => s.withUserCount())
   */
  static withUserCount = scope((query) => {
    query.withCount('tenant_users', (q) => {
      q.as('users_count').where('is_active', true)
    })
  })

  /**
   * Include tenant users relationship
   * @example Tenant.query().withScopes(s => s.withUsers())
   */
  static withUsers = scope((query) => {
    query.preload('tenant_users', (tuQuery) => {
      tuQuery.where('is_active', true).preload('user').orderBy('created_at', 'desc')
    })
  })

  /**
   * Filter tenants created between dates
   * @example Tenant.query().withScopes(s => s.createdBetween(from, to))
   */
  static createdBetween = scope((query, from: DateTime, to: DateTime) => {
    query.whereBetween('created_at', [from.toSQL(), to.toSQL()])
  })

  /**
   * Filter tenants created after date
   * @example Tenant.query().withScopes(s => s.createdAfter(date))
   */
  static createdAfter = scope((query, date: DateTime) => {
    query.where('created_at', '>', date.toSQL())
  })

  /**
   * Filter tenants created before date
   * @example Tenant.query().withScopes(s => s.createdBefore(date))
   */
  static createdBefore = scope((query, date: DateTime) => {
    query.where('created_at', '<', date.toSQL())
  })

  /**
   * Filter tenants created recently
   * @example Tenant.query().withScopes(s => s.recentlyCreated(7))
   */
  static recentlyCreated = scope((query, days = 7) => {
    const date = DateTime.now().minus({ days })
    query.where('created_at', '>=', date.toSQL())
  })

  /**
   * Order by creation date
   * @example Tenant.query().withScopes(s => s.newest())
   */
  static newest = scope((query) => {
    query.orderBy('created_at', 'desc')
  })

  /**
   * Order by name
   * @example Tenant.query().withScopes(s => s.alphabetical())
   */
  static alphabetical = scope((query) => {
    query.orderBy('name', 'asc')
  })
}
