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
import * as model from '@adonisjs/lucid/types/model'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import Role from '#models/role'
import Permission from '#models/permission'
import TenantUser from '#models/tenant_user'
import IRole from '#interfaces/role_interface'

const AuthFinder = withAuthFinder(() => hash.use('argon'), {
  uids: ['email', 'username'],
  passwordColumnName: 'password',
})

export default class User extends compose(BaseModel, AuthFinder) {
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
  static async softDeletes(query: model.ModelQueryBuilderContract<typeof User>) {
    query.where('is_deleted', false)
  }

  @beforePaginate()
  static async softDeletesPaginate(
    queries: [
      countQuery: model.ModelQueryBuilderContract<typeof User>,
      fetchQuery: model.ModelQueryBuilderContract<typeof User>,
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
   * @example User.query().withScopes(s => s.searchByTerm('john'))
   */
  static searchByTerm = scope((query: ModelQueryBuilderContract<typeof User>, term: string) => {
    if (!term || !term.trim()) return

    const searchTerm = `%${term.trim()}%`
    query.where((builder) => {
      builder
        .whereILike('full_name', searchTerm)
        .orWhereILike('email', searchTerm)
        .orWhereILike('username', searchTerm)
    })
  })

  /**
   * Filter users by tenant through TenantUser relationship
   * @example User.query().withScopes(s => s.forTenant(tenantId))
   */
  static forTenant = scope(
    (query: ModelQueryBuilderContract<typeof User>, tenantId: string | number) => {
      query.whereHas('tenant_users', (tenantQuery) => {
        tenantQuery.where('tenant_id', tenantId).where('is_active', true)
      })
    }
  )

  /**
   * Preload user roles
   * @example User.query().withScopes(s => s.withRoles())
   */
  static withRoles = scope((query: ModelQueryBuilderContract<typeof User>) => {
    query.preload('roles', (rolesQuery) => {
      rolesQuery.orderBy('slug', 'asc')
    })
  })

  /**
   * Preload user permissions (direct and from roles)
   * @example User.query().withScopes(s => s.withPermissions())
   */
  static withPermissions = scope((query: ModelQueryBuilderContract<typeof User>) => {
    query.preload('permissions').preload('roles', (rolesQuery) => {
      rolesQuery.preload('permissions')
    })
  })

  /**
   * Filter active users (not deleted)
   * @example User.query().withScopes(s => s.active())
   */
  static active = scope((query: ModelQueryBuilderContract<typeof User>) => {
    query.where('is_deleted', false)
  })

  /**
   * Filter users with verified email
   * @example User.query().withScopes(s => s.verified())
   */
  static verified = scope((query: ModelQueryBuilderContract<typeof User>) => {
    query.whereRaw("metadata->>'email_verified' = 'true'")
  })

  /**
   * Filter users by role
   * @example User.query().withScopes(s => s.byRole('admin'))
   */
  static byRole = scope((query: ModelQueryBuilderContract<typeof User>, roleSlug: string) => {
    query.whereHas('roles', (roleQuery) => {
      roleQuery.where('slug', roleSlug)
    })
  })

  /**
   * Filter users by multiple roles
   * @example User.query().withScopes(s => s.byRoles(['admin', 'manager']))
   */
  static byRoles = scope((query: ModelQueryBuilderContract<typeof User>, roleSlugs: string[]) => {
    query.whereHas('roles', (roleQuery) => {
      roleQuery.whereIn('slug', roleSlugs)
    })
  })

  /**
   * Filter users with specific permission
   * @example User.query().withScopes(s => s.withPermission('users.create'))
   */
  static withPermission = scope(
    (query: ModelQueryBuilderContract<typeof User>, permissionSlug: string) => {
      query.where((builder) => {
        // Direct permission
        builder
          .whereHas('permissions', (permQuery) => {
            permQuery.where('slug', permissionSlug).where('granted', true)
          })
          // Or permission through role
          .orWhereHas('roles', (roleQuery) => {
            roleQuery.whereHas('permissions', (permQuery) => {
              permQuery.where('slug', permissionSlug)
            })
          })
      })
    }
  )

  /**
   * Include tenant relationships for a user
   * @example User.query().withScopes(s => s.withTenants())
   */
  static withTenants = scope((query: ModelQueryBuilderContract<typeof User>) => {
    query.preload('tenant_users', (tuQuery) => {
      tuQuery.where('is_active', true).preload('tenant').orderBy('created_at', 'desc')
    })
  })

  /**
   * Order users by creation date
   * @example User.query().withScopes(s => s.recent())
   */
  static recent = scope((query) => {
    query.orderBy('created_at', 'desc')
  })

  /**
   * Filter users created in the last N days
   * @example User.query().withScopes(s => s.createdInLastDays(7))
   */
  static createdInLastDays = scope(
    (query: ModelQueryBuilderContract<typeof User>, days: number) => {
      const date = DateTime.now().minus({ days })
      query.where('created_at', '>=', date.toSQL())
    }
  )

  /**
   * Legacy method for backward compatibility
   * @deprecated Use withScopes(s => s.withRoles()) instead
   */
  static includeRoles(query: model.ModelQueryBuilderContract<typeof User>) {
    query.preload('roles')
  }
}
