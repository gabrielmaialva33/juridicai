import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, scope, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import Tenant from '#models/tenant'
import User from '#models/user'

export enum TenantUserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  LAWYER = 'lawyer',
  ASSISTANT = 'assistant',
}

type TenantUserRoleType = 'owner' | 'admin' | 'lawyer' | 'assistant'

export default class TenantUser extends BaseModel {
  static namingStrategy = new SnakeCaseNamingStrategy()

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
    consume: (value: string | null) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
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

  // Relationships
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
   * Query Scopes
   * ------------------------------------------------------
   */

  /**
   * Filter tenant users by tenant
   * @example TenantUser.query().withScopes(s => s.forTenant(tenantId))
   */
  static forTenant = scope(
    (query: ModelQueryBuilderContract<typeof TenantUser>, tenantId: string) => {
      query.where('tenant_id', tenantId)
    }
  )

  /**
   * Filter tenant users by user
   * @example TenantUser.query().withScopes(s => s.forUser(userId))
   */
  static forUser = scope((query: ModelQueryBuilderContract<typeof TenantUser>, userId: number) => {
    query.where('user_id', userId)
  })

  /**
   * Filter tenant users by role
   * @example TenantUser.query().withScopes(s => s.byRole('admin'))
   */
  static byRole = scope(
    (query: ModelQueryBuilderContract<typeof TenantUser>, role: TenantUserRoleType) => {
      query.where('role', role)
    }
  )

  /**
   * Filter tenant users by multiple roles
   * @example TenantUser.query().withScopes(s => s.byRoles(['admin', 'owner']))
   */
  static byRoles = scope(
    (query: ModelQueryBuilderContract<typeof TenantUser>, roles: TenantUserRoleType[]) => {
      query.whereIn('role', roles)
    }
  )

  /**
   * Filter owners
   * @example TenantUser.query().withScopes(s => s.owners())
   */
  static owners = scope((query: ModelQueryBuilderContract<typeof TenantUser>) => {
    query.where('role', TenantUserRole.OWNER)
  })

  /**
   * Filter admins
   * @example TenantUser.query().withScopes(s => s.admins())
   */
  static admins = scope((query: ModelQueryBuilderContract<typeof TenantUser>) => {
    query.where('role', TenantUserRole.ADMIN)
  })

  /**
   * Filter lawyers
   * @example TenantUser.query().withScopes(s => s.lawyers())
   */
  static lawyers = scope((query: ModelQueryBuilderContract<typeof TenantUser>) => {
    query.where('role', TenantUserRole.LAWYER)
  })

  /**
   * Filter assistants
   * @example TenantUser.query().withScopes(s => s.assistants())
   */
  static assistants = scope((query: ModelQueryBuilderContract<typeof TenantUser>) => {
    query.where('role', TenantUserRole.ASSISTANT)
  })

  /**
   * Filter active tenant users
   * @example TenantUser.query().withScopes(s => s.active())
   */
  static active = scope((query: ModelQueryBuilderContract<typeof TenantUser>) => {
    query.where('is_active', true)
  })

  /**
   * Filter inactive tenant users
   * @example TenantUser.query().withScopes(s => s.inactive())
   */
  static inactive = scope((query: ModelQueryBuilderContract<typeof TenantUser>) => {
    query.where('is_active', false)
  })

  /**
   * Filter tenant users who have joined
   * @example TenantUser.query().withScopes(s => s.joined())
   */
  static joined = scope((query: ModelQueryBuilderContract<typeof TenantUser>) => {
    query.whereNotNull('joined_at')
  })

  /**
   * Filter pending tenant users (invited but not joined)
   * @example TenantUser.query().withScopes(s => s.pending())
   */
  static pending = scope((query: ModelQueryBuilderContract<typeof TenantUser>) => {
    query.whereNotNull('invited_at').whereNull('joined_at')
  })

  /**
   * Filter tenant users with custom permissions
   * @example TenantUser.query().withScopes(s => s.hasCustomPermissions())
   */
  static hasCustomPermissions = scope((query: ModelQueryBuilderContract<typeof TenantUser>) => {
    query.whereNotNull('custom_permissions')
  })

  /**
   * Filter tenant users invited between dates
   * @example TenantUser.query().withScopes(s => s.invitedBetween(from, to))
   */
  static invitedBetween = scope(
    (query: ModelQueryBuilderContract<typeof TenantUser>, from: DateTime, to: DateTime) => {
      query.whereBetween('invited_at', [from.toSQL(), to.toSQL()])
    }
  )

  /**
   * Filter tenant users joined between dates
   * @example TenantUser.query().withScopes(s => s.joinedBetween(from, to))
   */
  static joinedBetween = scope(
    (query: ModelQueryBuilderContract<typeof TenantUser>, from: DateTime, to: DateTime) => {
      query.whereBetween('joined_at', [from.toSQL(), to.toSQL()])
    }
  )

  /**
   * Filter recently joined tenant users
   * @example TenantUser.query().withScopes(s => s.recentlyJoined(7))
   */
  static recentlyJoined = scope((query: ModelQueryBuilderContract<typeof TenantUser>, days = 7) => {
    const date = DateTime.now().minus({ days })
    query.whereNotNull('joined_at').where('joined_at', '>=', date.toSQL())
  })

  /**
   * Filter recently invited tenant users
   * @example TenantUser.query().withScopes(s => s.recentlyInvited(7))
   */
  static recentlyInvited = scope(
    (query: ModelQueryBuilderContract<typeof TenantUser>, days = 7) => {
      const date = DateTime.now().minus({ days })
      query.whereNotNull('invited_at').where('invited_at', '>=', date.toSQL())
    }
  )

  /**
   * Include tenant relationship
   * @example TenantUser.query().withScopes(s => s.withTenant())
   */
  static withTenant = scope((query: ModelQueryBuilderContract<typeof TenantUser>) => {
    query.preload('tenant')
  })

  /**
   * Include user relationship
   * @example TenantUser.query().withScopes(s => s.withUser())
   */
  static withUser = scope((query: ModelQueryBuilderContract<typeof TenantUser>) => {
    query.preload('user')
  })

  /**
   * Include all relationships
   * @example TenantUser.query().withScopes(s => s.withRelationships())
   */
  static withRelationships = scope((query: ModelQueryBuilderContract<typeof TenantUser>) => {
    query.preload('tenant').preload('user', (userQuery) => {
      userQuery.preload('roles')
    })
  })

  /**
   * Order by join date (newest first)
   * @example TenantUser.query().withScopes(s => s.byJoinDate())
   */
  static byJoinDate = scope((query: ModelQueryBuilderContract<typeof TenantUser>) => {
    query.orderBy('joined_at', 'desc')
  })

  /**
   * Order by role hierarchy (owner first, then admin, lawyer, assistant)
   * @example TenantUser.query().withScopes(s => s.byRoleHierarchy())
   */
  static byRoleHierarchy = scope((query: ModelQueryBuilderContract<typeof TenantUser>) => {
    query.orderByRaw(`
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
   * @example TenantUser.query().withScopes(s => s.newest())
   */
  static newest = scope((query: ModelQueryBuilderContract<typeof TenantUser>) => {
    query.orderBy('created_at', 'desc')
  })

  /**
   * Order by creation date (oldest first)
   * @example TenantUser.query().withScopes(s => s.oldest())
   */
  static oldest = scope((query: ModelQueryBuilderContract<typeof TenantUser>) => {
    query.orderBy('created_at', 'asc')
  })
}
