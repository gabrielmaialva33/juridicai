import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany, scope, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

import IRole from '#interfaces/role_interface'
import User from '#models/user'
import Permission from '#models/permission'

type Builder = ModelQueryBuilderContract<typeof Role>

export default class Role extends BaseModel {
  static table = 'roles'
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
  declare slug: IRole.Slugs

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  /**
   * ------------------------------------------------------
   * Relationships
   * ------------------------------------------------------
   */
  @manyToMany(() => User, {
    pivotTable: 'user_roles',
  })
  declare users: ManyToMany<typeof User>

  @manyToMany(() => Permission, {
    pivotTable: 'role_permissions',
    pivotTimestamps: true,
  })
  declare permissions: ManyToMany<typeof Permission>

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
   * Find role by slug
   * @example Role.query().withScopes((scopes) => scopes.bySlug('admin'))
   */
  static bySlug = scope((query, slug: IRole.Slugs) => {
    return query.where('slug', slug)
  })

  /**
   * Search roles by name
   * @example Role.query().withScopes((scopes) => scopes.search('admin'))
   */
  static search = scope((query, term: string) => {
    if (!term || !term.trim()) return query
    const searchTerm = `%${term.trim()}%`
    return query.whereILike('name', searchTerm)
  })

  /**
   * Include permissions relationship
   * @example Role.query().withScopes((scopes) => scopes.withPermissions())
   */
  static withPermissions = scope((query: Builder) => {
    return query.preload('permissions')
  })

  /**
   * Include users relationship
   * @example Role.query().withScopes((scopes) => scopes.withUsers())
   */
  static withUsers = scope((query: Builder) => {
    return query.preload('users')
  })

  /**
   * Order roles alphabetically by name
   * @example Role.query().withScopes((scopes) => scopes.alphabetical())
   */
  static alphabetical = scope((query: Builder) => {
    return query.orderBy('name', 'asc')
  })
}
