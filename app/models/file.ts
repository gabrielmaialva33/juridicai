import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, scope, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

import User from '#models/user'

type Builder = ModelQueryBuilderContract<typeof File>

export default class File extends BaseModel {
  static table = 'files'
  static namingStrategy = new SnakeCaseNamingStrategy()

  /**
   * ------------------------------------------------------
   * Columns
   * ------------------------------------------------------
   */
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare owner_id: number

  @column()
  declare client_name: string

  @column()
  declare file_name: string

  @column()
  declare file_size: number

  @column()
  declare file_type: string

  @column()
  declare file_category: string

  @column()
  declare url: string

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  /**
   * ------------------------------------------------------
   * Relationships
   * ------------------------------------------------------
   */
  @belongsTo(() => User, {
    foreignKey: 'owner_id',
  })
  declare owner: BelongsTo<typeof User>

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
   * Filter files by owner
   * @example File.query().withScopes((scopes) => scopes.byOwner(userId))
   */
  static byOwner = scope((query, ownerId: number) => {
    return query.where('owner_id', ownerId)
  })

  /**
   * Filter files by category
   * @example File.query().withScopes((scopes) => scopes.byCategory('documents'))
   */
  static byCategory = scope((query, category: string) => {
    return query.where('file_category', category)
  })

  /**
   * Filter files by type/mime type
   * @example File.query().withScopes((scopes) => scopes.byType('application/pdf'))
   */
  static byType = scope((query, fileType: string) => {
    return query.where('file_type', fileType)
  })

  /**
   * Search files by name or client name
   * @example File.query().withScopes((scopes) => scopes.search('contract'))
   */
  static search = scope((query, term: string) => {
    if (!term || !term.trim()) return query
    const searchTerm = `%${term.trim()}%`
    return query.where((builder) => {
      builder.whereILike('file_name', searchTerm).orWhereILike('client_name', searchTerm)
    })
  })

  /**
   * Filter files larger than size (in bytes)
   * @example File.query().withScopes((scopes) => scopes.largerThan(1048576))
   */
  static largerThan = scope((query, sizeInBytes: number) => {
    return query.where('file_size', '>', sizeInBytes)
  })

  /**
   * Filter files smaller than size (in bytes)
   * @example File.query().withScopes((scopes) => scopes.smallerThan(1048576))
   */
  static smallerThan = scope((query, sizeInBytes: number) => {
    return query.where('file_size', '<', sizeInBytes)
  })

  /**
   * Filter recent files
   * @example File.query().withScopes((scopes) => scopes.recent(7))
   */
  static recent = scope((query, days: number = 7) => {
    const date = DateTime.now().minus({ days })
    return query.where('created_at', '>=', date.toISO())
  })

  /**
   * Include owner relationship
   * @example File.query().withScopes((scopes) => scopes.withOwner())
   */
  static withOwner = scope((query: Builder) => {
    return query.preload('owner')
  })

  /**
   * Order by creation date (newest first)
   * @example File.query().withScopes((scopes) => scopes.newest())
   */
  static newest = scope((query: Builder) => {
    return query.orderBy('created_at', 'desc')
  })

  /**
   * Order by creation date (oldest first)
   * @example File.query().withScopes((scopes) => scopes.oldest())
   */
  static oldest = scope((query: Builder) => {
    return query.orderBy('created_at', 'asc')
  })

  /**
   * Order by file size (largest first)
   * @example File.query().withScopes((scopes) => scopes.byLargestSize())
   */
  static byLargestSize = scope((query: Builder) => {
    return query.orderBy('file_size', 'desc')
  })

  /**
   * Order by file size (smallest first)
   * @example File.query().withScopes((scopes) => scopes.bySmallestSize())
   */
  static bySmallestSize = scope((query: Builder) => {
    return query.orderBy('file_size', 'asc')
  })

  /**
   * ------------------------------------------------------
   * Helpers
   * ------------------------------------------------------
   */
  get file_size_mb(): number {
    return Math.round((this.file_size / 1024 / 1024) * 100) / 100
  }

  get file_extension(): string {
    return this.file_name.split('.').pop() || ''
  }

  get is_image(): boolean {
    return ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(
      this.file_type
    )
  }

  get is_pdf(): boolean {
    return this.file_type === 'application/pdf'
  }
}
