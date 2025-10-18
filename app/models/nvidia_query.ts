import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, scope, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import { compose } from '@adonisjs/core/helpers'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

import { withTenantScope } from '#mixins/with_tenant_scope'
import User from '#models/user'
import Case from '#models/case'

type Builder = ModelQueryBuilderContract<typeof NvidiaQuery>

type QueryType =
  | 'document_analysis'
  | 'contract_review'
  | 'code_generation'
  | 'text_analysis'
  | 'general'

interface QueryMetadata {
  analysis_type?: string
  review_focus?: string[]
  template_type?: string
  context?: string
  temperature?: number
  top_p?: number
  max_tokens?: number
  [key: string]: any
}

// Create the tenant-scoped mixin
const TenantScoped = withTenantScope()

export default class NvidiaQuery extends compose(BaseModel, TenantScoped) {
  static table = 'nvidia_queries'
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
  declare query: string

  @column()
  declare response: string

  @column()
  declare query_type: QueryType

  @column()
  declare model: string

  @column()
  declare temperature: number | null

  @column()
  declare top_p: number | null

  @column()
  declare tokens_used: number | null

  @column()
  declare prompt_tokens: number | null

  @column()
  declare completion_tokens: number | null

  @column({
    prepare: (value: QueryMetadata | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | QueryMetadata | null) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare metadata: QueryMetadata | null

  @column()
  declare case_id: number | null

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
    foreignKey: 'user_id',
  })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Case, {
    foreignKey: 'case_id',
  })
  declare caseRecord: BelongsTo<typeof Case>

  /**
   * ------------------------------------------------------
   * Query Scopes
   * ------------------------------------------------------
   */

  /**
   * Filter by query type
   * @example NvidiaQuery.query().withScopes((scopes) => scopes.ofType('document_analysis'))
   */
  static ofType = scope((query, type: QueryType) => {
    return query.where('query_type', type)
  })

  /**
   * Filter by user ID
   * @example NvidiaQuery.query().withScopes((scopes) => scopes.byUser(userId))
   */
  static byUser = scope((query, userId: number) => {
    return query.where('user_id', userId)
  })

  /**
   * Filter by case ID
   * @example NvidiaQuery.query().withScopes((scopes) => scopes.byCase(caseId))
   */
  static byCase = scope((query, caseId: number) => {
    return query.where('case_id', caseId)
  })

  /**
   * Filter by model used
   * @example NvidiaQuery.query().withScopes((scopes) => scopes.byModel('qwen/qwen3-coder-480b-a35b-instruct'))
   */
  static byModel = scope((query, model: string) => {
    return query.where('model', model)
  })

  /**
   * Search queries by text
   * @example NvidiaQuery.query().withScopes((scopes) => scopes.search('contrato'))
   */
  static search = scope((query, term: string) => {
    if (!term || !term.trim()) return query

    const searchTerm = `%${term.trim()}%`
    return query.where((builder) => {
      builder.whereILike('query', searchTerm).orWhereILike('response', searchTerm)
    })
  })

  /**
   * Filter queries created recently
   * @example NvidiaQuery.query().withScopes((scopes) => scopes.recent(7))
   */
  static recent = scope((query: Builder, days = 7) => {
    const date = DateTime.now().minus({ days })
    return query.where('created_at', '>=', date.toISO())
  })

  /**
   * Filter queries created between dates
   * @example NvidiaQuery.query().withScopes((scopes) => scopes.createdBetween(from, to))
   */
  static createdBetween = scope((query, from: DateTime, to: DateTime) => {
    return query.whereBetween('created_at', [from.toISO()!, to.toISO()!])
  })

  /**
   * Order by creation date (newest first)
   * @example NvidiaQuery.query().withScopes((scopes) => scopes.newest())
   */
  static newest = scope((query: Builder) => {
    return query.orderBy('created_at', 'desc')
  })

  /**
   * Order by creation date (oldest first)
   * @example NvidiaQuery.query().withScopes((scopes) => scopes.oldest())
   */
  static oldest = scope((query: Builder) => {
    return query.orderBy('created_at', 'asc')
  })

  /**
   * Order by tokens used (most expensive first)
   * @example NvidiaQuery.query().withScopes((scopes) => scopes.mostExpensive())
   */
  static mostExpensive = scope((query: Builder) => {
    return query.orderBy('tokens_used', 'desc')
  })

  /**
   * Include user relationship
   * @example NvidiaQuery.query().withScopes((scopes) => scopes.withUser())
   */
  static withUser = scope((query: Builder) => {
    return query.preload('user')
  })

  /**
   * Include case relationship
   * @example NvidiaQuery.query().preload('caseRecord')
   */
  static withCaseRecord = scope((query: Builder) => {
    return query.preload('caseRecord' as any)
  })
}
