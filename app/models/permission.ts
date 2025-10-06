import { DateTime } from 'luxon'
import {
  BaseModel,
  beforeCreate,
  column,
  manyToMany,
  scope,
  SnakeCaseNamingStrategy,
} from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'

import User from '#models/user'
import Role from '#models/role'

export default class Permission extends BaseModel {
  static table = 'permissions'
  static namingStrategy = new SnakeCaseNamingStrategy()

  /**
   * ------------------------------------------------------
   * Columns
   * ------------------------------------------------------
   */
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare resource: string

  @column()
  declare action: string

  @column()
  declare context: string

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  /**
   * ------------------------------------------------------
   * Relationships
   * ------------------------------------------------------
   */
  @manyToMany(() => Role, {
    pivotTable: 'role_permissions',
    pivotTimestamps: true,
  })
  declare roles: ManyToMany<typeof Role>

  @manyToMany(() => User, {
    pivotTable: 'user_permissions',
    pivotTimestamps: true,
    pivotColumns: ['granted', 'expires_at'],
  })
  declare users: ManyToMany<typeof User>

  /**
   * ------------------------------------------------------
   * Hooks
   * ------------------------------------------------------
   */
  @beforeCreate()
  static async generateName(permission: Permission) {
    if (!permission.name) {
      const context = permission.context || 'any'
      permission.name = `${permission.resource}.${permission.action}.${context}`
    }
  }

  /**
   * ------------------------------------------------------
   * Query Scopes
   * ------------------------------------------------------
   */

  /**
   * Filter permissions by resource
   * @example Permission.query().withScopes((scopes) => scopes.byResource('users'))
   */
  static byResource = scope((query, resource: string) => {
    return query.where('resource', resource)
  })

  /**
   * Filter permissions by action
   * @example Permission.query().withScopes((scopes) => scopes.byAction('create'))
   */
  static byAction = scope((query, action: string) => {
    return query.where('action', action)
  })

  /**
   * Filter permissions by context
   * @example Permission.query().withScopes((scopes) => scopes.byContext('tenant'))
   */
  static byContext = scope((query, context: string) => {
    return query.where('context', context)
  })

  /**
   * Filter permissions by resource, action, and context
   * @example Permission.query().withScopes((scopes) => scopes.byResourceActionContext('users', 'create', 'tenant'))
   */
  static byResourceActionContext = scope(
    (query, resource: string, action: string, context: string = 'any') => {
      return query.where('resource', resource).where('action', action).where('context', context)
    }
  )
}
