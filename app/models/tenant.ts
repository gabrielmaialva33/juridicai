import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, scope, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import TenantUser from '#models/tenant_user'

type Builder = ModelQueryBuilderContract<typeof Tenant>

type TenantPlan = 'free' | 'starter' | 'pro' | 'enterprise'

interface TenantLimits {
  max_users?: number
  max_cases?: number
  max_storage_gb?: number
  max_documents?: number

  [key: string]: any
}

export default class Tenant extends BaseModel {
  static table = 'tenants'
  static namingStrategy = new SnakeCaseNamingStrategy()

  /**
   * ------------------------------------------------------
   * Columns
   * ------------------------------------------------------
   */
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

  /**
   * ------------------------------------------------------
   * Relationships
   * ------------------------------------------------------
   */
  @hasMany(() => TenantUser, {
    foreignKey: 'tenant_id',
  })
  declare tenant_users: HasMany<typeof TenantUser>

  /**
   * ------------------------------------------------------
   * Hooks
   * ------------------------------------------------------
   */

  /**
   * ------------------------------------------------------
   * Query Scopes
   * ------------------------------------------------------
   */

  /**
   * Filter active tenants
   * @example Tenant.query().withScopes((scopes) => scopes.active())
   */
  static active = scope((query: Builder) => {
    return query.where('is_active', true)
  })

  /**
   * Filter tenants by plan
   * @example Tenant.query().withScopes((scopes) => scopes.byPlan('pro'))
   */
  static byPlan = scope((query, plan: TenantPlan) => {
    return query.where('plan', plan)
  })

  /**
   * Filter tenants by multiple plans
   * @example Tenant.query().withScopes((scopes) => scopes.byPlans(['pro', 'enterprise']))
   */
  static byPlans = scope((query, plans: TenantPlan[]) => {
    return query.whereIn('plan', plans)
  })

  /**
   * Find tenant by subdomain
   * @example Tenant.query().withScopes((scopes) => scopes.bySubdomain('acme'))
   */
  static bySubdomain = scope((query, subdomain: string) => {
    return query.where('subdomain', subdomain)
  })

  /**
   * Find tenant by custom domain
   * @example Tenant.query().withScopes((scopes) => scopes.byCustomDomain('acme.com'))
   */
  static byCustomDomain = scope((query, domain: string) => {
    return query.where('custom_domain', domain)
  })

  /**
   * Search tenants by name or subdomain
   * @example Tenant.query().withScopes((scopes) => scopes.search('acme'))
   */
  static search = scope((query, term: string) => {
    if (!term || !term.trim()) return query

    const searchTerm = `%${term.trim()}%`
    return query.where((builder) => {
      builder
        .whereILike('name', searchTerm)
        .orWhereILike('subdomain', searchTerm)
        .orWhereILike('custom_domain', searchTerm)
    })
  })

  /**
   * Include tenant limits in response
   * @example Tenant.query().withScopes((scopes) => scopes.withLimits())
   */
  static withLimits = scope((query: Builder) => {
    return query.select('*', 'limits')
  })

  /**
   * Filter tenants near their limits
   * @example Tenant.query().withScopes((scopes) => scopes.nearLimits(0.8))
   */
  static nearLimits = scope((query: Builder, _threshold = 0.8) => {
    // This would require a more complex query based on actual usage
    // For now, just filter tenants with limits set
    return query.whereNotNull('limits')
  })

  /**
   * Filter suspended tenants
   * @example Tenant.query().withScopes((scopes) => scopes.suspended())
   */
  static suspended = scope((query: Builder) => {
    return query.whereNotNull('suspended_at')
  })

  /**
   * Filter non-suspended tenants
   * @example Tenant.query().withScopes((scopes) => scopes.notSuspended())
   */
  static notSuspended = scope((query: Builder) => {
    return query.whereNull('suspended_at')
  })

  /**
   * Filter tenants in trial
   * @example Tenant.query().withScopes((scopes) => scopes.inTrial())
   */
  static inTrial = scope((query: Builder) => {
    return query.whereNotNull('trial_ends_at').where('trial_ends_at', '>', DateTime.now().toISO())
  })

  /**
   * Filter tenants with expired trial
   * @example Tenant.query().withScopes((scopes) => scopes.trialExpired())
   */
  static trialExpired = scope((query: Builder) => {
    return query.whereNotNull('trial_ends_at').where('trial_ends_at', '<=', DateTime.now().toISO())
  })

  /**
   * Include tenant users count
   * @example Tenant.query().withScopes((scopes) => scopes.withUserCount())
   */
  static withUserCount = scope((query: Builder) => {
    return query.withCount('tenant_users', (q) => {
      q.as('users_count').where('is_active', true)
    })
  })

  /**
   * Include tenant users relationship
   * @example Tenant.query().withScopes((scopes) => scopes.withUsers())
   */
  static withUsers = scope((query: Builder) => {
    return query.preload('tenant_users', (tuQuery) => {
      tuQuery.where('is_active', true).preload('user').orderBy('created_at', 'desc')
    })
  })

  /**
   * Filter tenants created between dates
   * @example Tenant.query().withScopes((scopes) => scopes.createdBetween(from, to))
   */
  static createdBetween = scope((query, from: DateTime, to: DateTime) => {
    return query.whereBetween('created_at', [from.toISO()!, to.toISO()!])
  })

  /**
   * Filter tenants created after date
   * @example Tenant.query().withScopes((scopes) => scopes.createdAfter(date))
   */
  static createdAfter = scope((query, date: DateTime) => {
    return query.where('created_at', '>', date.toISO()!)
  })

  /**
   * Filter tenants created before date
   * @example Tenant.query().withScopes((scopes) => scopes.createdBefore(date))
   */
  static createdBefore = scope((query, date: DateTime) => {
    return query.where('created_at', '<'!, date.toISO()!)
  })

  /**
   * Filter tenants created recently
   * @example Tenant.query().withScopes((scopes) => scopes.recentlyCreated(7))
   */
  static recentlyCreated = scope((query: Builder, days = 7) => {
    const date = DateTime.now().minus({ days })
    return query.where('created_at', '>=', date.toISO())
  })

  /**
   * Order by creation date
   * @example Tenant.query().withScopes((scopes) => scopes.newest())
   */
  static newest = scope((query: Builder) => {
    return query.orderBy('created_at', 'desc')
  })

  /**
   * Order by name
   * @example Tenant.query().withScopes((scopes) => scopes.alphabetical())
   */
  static alphabetical = scope((query: Builder) => {
    return query.orderBy('name', 'asc')
  })
}
