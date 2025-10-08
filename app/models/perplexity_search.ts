import { DateTime } from 'luxon'
import {
  BaseModel,
  column,
  belongsTo,
  scope,
  SnakeCaseNamingStrategy,
} from '@adonisjs/lucid/orm'
import { compose } from '@adonisjs/core/helpers'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

import { withTenantScope } from '#mixins/with_tenant_scope'
import User from '#models/user'
import Case from '#models/case'

type Builder = ModelQueryBuilderContract<typeof PerplexitySearch>

type SearchType = 'legal_research' | 'legislation' | 'case_analysis' | 'legal_writing' | 'general'

interface SearchMetadata {
  domain_filter?: string[]
  recency_filter?: string
  related_questions?: string[]
  temperature?: number
  max_tokens?: number
  [key: string]: any
}

interface SearchResult {
  title: string
  url: string
  date?: string
  snippet?: string
}

// Create the tenant-scoped mixin
const TenantScoped = withTenantScope()

export default class PerplexitySearch extends compose(BaseModel, TenantScoped) {
  static table = 'perplexity_searches'
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
  declare search_type: SearchType

  @column()
  declare model: string

  @column()
  declare search_mode: string | null

  @column()
  declare tokens_used: number | null

  @column()
  declare prompt_tokens: number | null

  @column()
  declare completion_tokens: number | null

  @column({
    prepare: (value: SearchMetadata | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | SearchMetadata | null) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare metadata: SearchMetadata | null

  @column({
    prepare: (value: SearchResult[] | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | SearchResult[] | null) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare search_results: SearchResult[] | null

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
  declare case: BelongsTo<typeof Case>

  /**
   * ------------------------------------------------------
   * Query Scopes
   * ------------------------------------------------------
   */

  /**
   * Filter by search type
   * @example PerplexitySearch.query().withScopes((scopes) => scopes.ofType('legal_research'))
   */
  static ofType = scope((query, type: SearchType) => {
    return query.where('search_type', type)
  })

  /**
   * Filter by user ID
   * @example PerplexitySearch.query().withScopes((scopes) => scopes.byUser(userId))
   */
  static byUser = scope((query, userId: number) => {
    return query.where('user_id', userId)
  })

  /**
   * Filter by case ID
   * @example PerplexitySearch.query().withScopes((scopes) => scopes.byCase(caseId))
   */
  static byCase = scope((query, caseId: number) => {
    return query.where('case_id', caseId)
  })

  /**
   * Filter by model used
   * @example PerplexitySearch.query().withScopes((scopes) => scopes.byModel('sonar-pro'))
   */
  static byModel = scope((query, model: string) => {
    return query.where('model', model)
  })

  /**
   * Search queries by text
   * @example PerplexitySearch.query().withScopes((scopes) => scopes.search('jurisprudência'))
   */
  static search = scope((query, term: string) => {
    if (!term || !term.trim()) return query

    const searchTerm = `%${term.trim()}%`
    return query.where((builder) => {
      builder.whereILike('query', searchTerm).orWhereILike('response', searchTerm)
    })
  })

  /**
   * Filter searches created recently
   * @example PerplexitySearch.query().withScopes((scopes) => scopes.recent(7))
   */
  static recent = scope((query: Builder, days = 7) => {
    const date = DateTime.now().minus({ days })
    return query.where('created_at', '>=', date.toISO())
  })

  /**
   * Filter searches created between dates
   * @example PerplexitySearch.query().withScopes((scopes) => scopes.createdBetween(from, to))
   */
  static createdBetween = scope((query, from: DateTime, to: DateTime) => {
    return query.whereBetween('created_at', [from.toISO()!, to.toISO()!])
  })

  /**
   * Order by creation date (newest first)
   * @example PerplexitySearch.query().withScopes((scopes) => scopes.newest())
   */
  static newest = scope((query: Builder) => {
    return query.orderBy('created_at', 'desc')
  })

  /**
   * Order by creation date (oldest first)
   * @example PerplexitySearch.query().withScopes((scopes) => scopes.oldest())
   */
  static oldest = scope((query: Builder) => {
    return query.orderBy('created_at', 'asc')
  })

  /**
   * Order by tokens used (most expensive first)
   * @example PerplexitySearch.query().withScopes((scopes) => scopes.mostExpensive())
   */
  static mostExpensive = scope((query: Builder) => {
    return query.orderBy('tokens_used', 'desc')
  })

  /**
   * Include user relationship
   * @example PerplexitySearch.query().withScopes((scopes) => scopes.withUser())
   */
  static withUser = scope((query: Builder) => {
    return query.preload('user')
  })

  /**
   * Include case relationship
   * @example PerplexitySearch.query().withScopes((scopes) => scopes.withCase())
   */
  static withCase = scope((query: Builder) => {
    return query.preload('case')
  })
}
