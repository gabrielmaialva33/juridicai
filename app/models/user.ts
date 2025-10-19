import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import {
  afterCreate,
  BaseModel,
  beforeCreate,
  beforeFetch,
  beforeFind,
  beforePaginate,
  beforeSave,
  column,
  hasMany,
  manyToMany,
  scope,
  SnakeCaseNamingStrategy,
} from '@adonisjs/lucid/orm'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

import Role from '#models/role'
import Permission from '#models/permission'
import TenantUser from '#models/tenant_user'
import IRole from '#interfaces/role_interface'
import { withTenantScope } from '#mixins/with_tenant_scope'

const AuthFinder = withAuthFinder(() => hash.use('argon'), {
  uids: ['email', 'username'],
  passwordColumnName: 'password',
})

const TenantScoped = withTenantScope()

export default class User extends compose(BaseModel, AuthFinder, TenantScoped) {
  static accessTokens = DbAccessTokensProvider.forModel(User)
  static refreshTokens = DbAccessTokensProvider.forModel(User, {
    type: 'refresh_token',
    expiresIn: '3d',
  })

  static table = 'users'
  static namingStrategy = new SnakeCaseNamingStrategy()

  /**
   * ------------------------------------------------------
   * Columns
   * ------------------------------------------------------
   */
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare full_name: string

  @column()
  declare email: string

  @column()
  declare username: string | null

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare tenant_id: string

  @column()
  declare firebase_uid: string | null

  @column({ serializeAs: null })
  declare is_deleted: boolean

  @column({
    prepare: (value) => JSON.stringify(value),
    consume: (value) => {
      if (typeof value === 'string') {
        return JSON.parse(value)
      }
      return value
    },
  })
  declare metadata: {
    email_verified: boolean
    email_verification_token: string | null
    email_verification_sent_at: string | null
    email_verified_at: string | null
  }

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime | null

  /**
   * ------------------------------------------------------
   * Relationships
   * ------------------------------------------------------
   */
  @manyToMany(() => Role, {
    pivotTable: 'user_roles',
  })
  declare roles: ManyToMany<typeof Role>

  @manyToMany(() => Permission, {
    pivotTable: 'user_permissions',
    pivotTimestamps: true,
    pivotColumns: ['granted', 'expires_at'],
  })
  declare permissions: ManyToMany<typeof Permission>

  @hasMany(() => TenantUser, {
    foreignKey: 'user_id',
  })
  declare tenant_users: HasMany<typeof TenantUser>

  /**
   * ------------------------------------------------------
   * Hooks
   * ------------------------------------------------------
   */
  @beforeFind()
  @beforeFetch()
  static async softDeletes(query: ModelQueryBuilderContract<typeof User>) {
    query.where('is_deleted', false)
  }

  @beforePaginate()
  static async softDeletesPaginate(
    queries: [
      countQuery: ModelQueryBuilderContract<typeof User>,
      fetchQuery: ModelQueryBuilderContract<typeof User>,
    ]
  ) {
    queries.forEach((query) => query.where('is_deleted', false))
  }

  @beforeCreate()
  static async setUsername(user: User) {
    if (!user.username) {
      user.username = user.email.split('@')[0].trim().toLowerCase()
    }
  }

  @beforeSave()
  static async hashUserPassword(user: User) {
    if (user.$dirty.password && !hash.isValidHash(user.password)) {
      user.password = await hash.make(user.password)
    }
  }

  @afterCreate()
  static async setDefaultRole(user: User) {
    const role = await Role.findBy('slug', IRole.Slugs.USER)
    if (role) {
      await user.related('roles').attach([role.id])
    }
  }

  /**
   * ------------------------------------------------------
   * Query Scopes
   * ------------------------------------------------------
   */

  /**
   * Search users by name or email
   * @example User.query().withScopes((scopes) => scopes.searchByTerm('john'))
   */
  static searchByTerm = scope((query, term: string) => {
    if (!term || !term.trim()) return query

    const searchTerm = `%${term.trim()}%`
    return query.where((builder) => {
      builder
        .whereILike('full_name', searchTerm)
        .orWhereILike('email', searchTerm)
        .orWhereILike('username', searchTerm)
    })
  })

  /**
   * Filter users by tenant through TenantUser relationship
   * Note: Use this instead of the mixin's forTenant() for relationship-based filtering
   * @example User.query().withScopes((scopes) => scopes.byTenantRelation(tenantId))
   */
  static byTenantRelation = scope((query: any, tenantId: string | number) => {
    return query.whereHas('tenant_users', (tenantQuery: any) => {
      tenantQuery.where('tenant_id', tenantId).where('is_active', true)
    })
  })

  /**
   * Preload user roles
   * @example User.query().withScopes((scopes) => scopes.withRoles())
   */
  static withRoles = scope((query: any) => {
    return query.preload('roles', (rolesQuery: any) => {
      rolesQuery.orderBy('slug', 'asc')
    })
  })

  /**
   * Preload user permissions (direct and from roles)
   * @example User.query().withScopes((scopes) => scopes.withPermissions())
   */
  static withPermissions = scope((query: any) => {
    return query.preload('permissions').preload('roles', (rolesQuery: any) => {
      rolesQuery.preload('permissions')
    })
  })

  /**
   * Filter active users (not deleted)
   * @example User.query().withScopes((scopes) => scopes.active())
   */
  static active = scope((query: any) => {
    return query.where('is_deleted', false)
  })

  /**
   * Filter users with verified email
   * @example User.query().withScopes((scopes) => scopes.verified())
   */
  static verified = scope((query: any) => {
    return query.whereRaw("metadata->>'email_verified' = 'true'")
  })

  /**
   * Filter users by role
   * @example User.query().withScopes((scopes) => scopes.byRole('admin'))
   */
  static byRole = scope((query: any, roleSlug: string) => {
    return query.whereHas('roles', (roleQuery: any) => {
      roleQuery.where('slug', roleSlug)
    })
  })

  /**
   * Filter users by multiple roles
   * @example User.query().withScopes((scopes) => scopes.byRoles(['admin', 'manager']))
   */
  static byRoles = scope((query: any, roleSlugs: string[]) => {
    return query.whereHas('roles', (roleQuery: any) => {
      roleQuery.whereIn('slug', roleSlugs)
    })
  })

  /**
   * Filter users with specific permission
   * @example User.query().withScopes((scopes) => scopes.withPermission('users.create'))
   */
  static withPermission = scope((query: any, permissionSlug: string) => {
    return query.where((builder: any) => {
      // Direct permission
      builder
        .whereHas('permissions', (permQuery: any) => {
          permQuery.where('slug', permissionSlug).where('granted', true)
        })
        // Or permission through role
        .orWhereHas('roles', (roleQuery: any) => {
          roleQuery.whereHas('permissions', (permQuery: any) => {
            permQuery.where('slug', permissionSlug)
          })
        })
    })
  })

  /**
   * Include tenant relationships for a user
   * @example User.query().withScopes((scopes) => scopes.withTenants())
   */
  static withTenants = scope((query: any) => {
    return query.preload('tenant_users', (tuQuery: any) => {
      tuQuery.where('is_active', true).preload('tenant').orderBy('created_at', 'desc')
    })
  })

  /**
   * Order users by creation date
   * @example User.query().withScopes((scopes) => scopes.recent())
   */
  static recent = scope((query: any) => {
    return query.orderBy('created_at', 'desc')
  })

  /**
   * Filter users created in the last N days
   * @example User.query().withScopes((scopes) => scopes.createdInLastDays(7))
   */
  static createdInLastDays = scope((query, days: number) => {
    const date = DateTime.now().minus({ days })
    return query.where('created_at', '>=', date.toISO())
  })

  /**
   * Legacy method for backward compatibility
   * @deprecated Use withScopes(s => s.withRoles()) instead
   */
  static includeRoles(query: ModelQueryBuilderContract<typeof User>) {
    query.preload('roles')
  }
}
