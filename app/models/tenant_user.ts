import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, scope, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import Tenant from '#models/tenant'
import User from '#models/user'

type Builder = ModelQueryBuilderContract<typeof TenantUser>

export enum TenantUserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  LAWYER = 'lawyer',
  ASSISTANT = 'assistant',
}

type TenantUserRoleType = 'owner' | 'admin' | 'lawyer' | 'assistant'

export default class TenantUser extends BaseModel {
  static table = 'tenant_users'
  static namingStrategy = new SnakeCaseNamingStrategy()

  /**
   * ------------------------------------------------------
   * Columns
   * ------------------------------------------------------
   */
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: string

  @column()
  declare user_id: number

  @column()
  declare role: TenantUserRole

  @column({
    prepare: (value: Record<string, any> | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | null) => (value ? JSON.parse(value) : null),
  })
  declare custom_permissions: Record<string, any> | null

  @column()
  declare is_active: boolean

  @column.dateTime()
  declare invited_at: DateTime | null

  @column.dateTime()
  declare joined_at: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  /**
   * ------------------------------------------------------
   * Relationships
   * ------------------------------------------------------
   */
  @belongsTo(() => Tenant, {
    foreignKey: 'tenant_id',
  })
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => User, {
    foreignKey: 'user_id',
  })
  declare user: BelongsTo<typeof User>

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
   * Filter tenant users by tenant
   * @example TenantUser.query().withScopes((scopes) => scopes.forTenant(tenantId))
   */
  static forTenant = scope((query, tenantId: string) => {
    return query.where('tenant_id', tenantId)
  })

  /**
   * Filter tenant users by user
   * @example TenantUser.query().withScopes((scopes) => scopes.forUser(userId))
   */
  static forUser = scope((query, userId: number) => {
    return query.where('user_id', userId)
  })

  /**
   * Filter tenant users by role
   * @example TenantUser.query().withScopes((scopes) => scopes.byRole('admin'))
   */
  static byRole = scope((query, role: TenantUserRoleType) => {
    return query.where('role', role)
  })

  /**
   * Filter tenant users by multiple roles
   * @example TenantUser.query().withScopes((scopes) => scopes.byRoles(['admin', 'owner']))
   */
  static byRoles = scope((query, roles: TenantUserRoleType[]) => {
    return query.whereIn('role', roles)
  })

  /**
   * Filter owners
   * @example TenantUser.query().withScopes((scopes) => scopes.owners())
   */
  static owners = scope((query: Builder) => {
    return query.where('role', TenantUserRole.OWNER)
  })

  /**
   * Filter admins
   * @example TenantUser.query().withScopes((scopes) => scopes.admins())
   */
  static admins = scope((query: Builder) => {
    return query.where('role', TenantUserRole.ADMIN)
  })

  /**
   * Filter lawyers
   * @example TenantUser.query().withScopes((scopes) => scopes.lawyers())
   */
  static lawyers = scope((query: Builder) => {
    return query.where('role', TenantUserRole.LAWYER)
  })

  /**
   * Filter assistants
   * @example TenantUser.query().withScopes((scopes) => scopes.assistants())
   */
  static assistants = scope((query: Builder) => {
    return query.where('role', TenantUserRole.ASSISTANT)
  })

  /**
   * Filter active tenant users
   * @example TenantUser.query().withScopes((scopes) => scopes.active())
   */
  static active = scope((query: Builder) => {
    return query.where('is_active', true)
  })

  /**
   * Filter inactive tenant users
   * @example TenantUser.query().withScopes((scopes) => scopes.inactive())
   */
  static inactive = scope((query: Builder) => {
    return query.where('is_active', false)
  })

  /**
   * Filter tenant users who have joined
   * @example TenantUser.query().withScopes((scopes) => scopes.joined())
   */
  static joined = scope((query: Builder) => {
    return query.whereNotNull('joined_at')
  })

  /**
   * Filter pending tenant users (invited but not joined)
   * @example TenantUser.query().withScopes((scopes) => scopes.pending())
   */
  static pending = scope((query: Builder) => {
    return query.whereNotNull('invited_at').whereNull('joined_at')
  })

  /**
   * Filter tenant users with custom permissions
   * @example TenantUser.query().withScopes((scopes) => scopes.hasCustomPermissions())
   */
  static hasCustomPermissions = scope((query: Builder) => {
    return query.whereNotNull('custom_permissions')
  })

  /**
   * Filter tenant users invited between dates
   * @example TenantUser.query().withScopes((scopes) => scopes.invitedBetween(from, to))
   */
  static invitedBetween = scope((query, from: DateTime, to: DateTime) => {
    return query.whereBetween('invited_at', [from.toISO()!, to.toISO()!])
  })

  /**
   * Filter tenant users joined between dates
   * @example TenantUser.query().withScopes((scopes) => scopes.joinedBetween(from, to))
   */
  static joinedBetween = scope((query, from: DateTime, to: DateTime) => {
    return query.whereBetween('joined_at', [from.toISO()!, to.toISO()!])
  })

  /**
   * Filter recently joined tenant users
   * @example TenantUser.query().withScopes((scopes) => scopes.recentlyJoined(7))
   */
  static recentlyJoined = scope((query: Builder, days = 7) => {
    const date = DateTime.now().minus({ days })
    return query.whereNotNull('joined_at').where('joined_at', '>=', date.toISO())
  })

  /**
   * Filter recently invited tenant users
   * @example TenantUser.query().withScopes((scopes) => scopes.recentlyInvited(7))
   */
  static recentlyInvited = scope((query: Builder, days = 7) => {
    const date = DateTime.now().minus({ days })
    return query.whereNotNull('invited_at').where('invited_at', '>=', date.toISO())
  })

  /**
   * Include tenant relationship
   * @example TenantUser.query().withScopes((scopes) => scopes.withTenant())
   */
  static withTenant = scope((query: Builder) => {
    return query.preload('tenant')
  })

  /**
   * Include user relationship
   * @example TenantUser.query().withScopes((scopes) => scopes.withUser())
   */
  static withUser = scope((query: Builder) => {
    return query.preload('user')
  })

  /**
   * Include all relationships
   * @example TenantUser.query().withScopes((scopes) => scopes.withRelationships())
   */
  static withRelationships = scope((query: Builder) => {
    return query.preload('tenant').preload('user', (userQuery) => {
      userQuery.preload('roles')
    })
  })

  /**
   * Order by join date (newest first)
   * @example TenantUser.query().withScopes((scopes) => scopes.byJoinDate())
   */
  static byJoinDate = scope((query: Builder) => {
    return query.orderBy('joined_at', 'desc')
  })

  /**
   * Order by role hierarchy (owner first, then admin, lawyer, assistant)
   * @example TenantUser.query().withScopes((scopes) => scopes.byRoleHierarchy())
   */
  static byRoleHierarchy = scope((query: Builder) => {
    return query.orderByRaw(`
      CASE role
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'lawyer' THEN 3
        WHEN 'assistant' THEN 4
      END ASC
    `)
  })

  /**
   * Order by creation date (newest first)
   * @example TenantUser.query().withScopes((scopes) => scopes.newest())
   */
  static newest = scope((query: Builder) => {
    return query.orderBy('created_at', 'desc')
  })

  /**
   * Order by creation date (oldest first)
   * @example TenantUser.query().withScopes((scopes) => scopes.oldest())
   */
  static oldest = scope((query: Builder) => {
    return query.orderBy('created_at', 'asc')
  })
}
