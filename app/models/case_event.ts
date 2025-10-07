import { DateTime } from 'luxon'
import {
  BaseModel,
  belongsTo,
  column,
  computed,
  scope,
  SnakeCaseNamingStrategy,
} from '@adonisjs/lucid/orm'
import { compose } from '@adonisjs/core/helpers'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

import { withTenantScope } from '#mixins/with_tenant_scope'
import Case from '#models/case'
import User from '#models/user'

type Builder = ModelQueryBuilderContract<typeof CaseEvent>

type EventType =
  | 'filing'
  | 'hearing'
  | 'decision'
  | 'publication'
  | 'appeal'
  | 'motion'
  | 'settlement'
  | 'judgment'
  | 'other'
type EventSource = 'manual' | 'court_api' | 'email' | 'import'

// Create the tenant-scoped mixin
const TenantScoped = withTenantScope()

export default class CaseEvent extends compose(BaseModel, TenantScoped) {
  static table = 'case_events'
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
  declare case_id: number

  @column()
  declare event_type: EventType

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column.dateTime()
  declare event_date: DateTime

  @column()
  declare source: EventSource

  @column({
    prepare: (value: Record<string, any> | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | Record<string, any> | null) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare metadata: Record<string, any> | null

  @column()
  declare created_by: number | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  /**
   * ------------------------------------------------------
   * Relationships
   * ------------------------------------------------------
   */
  @belongsTo(() => Case, { foreignKey: 'case_id' })
  declare case: BelongsTo<typeof Case>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

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
   * Search events by title or description
   * @example CaseEvent.query().withScopes((scopes) => scopes.search('hearing'))
   */
  static search = scope((query, term: string) => {
    if (!term || !term.trim()) return query

    const searchTerm = `%${term.trim()}%`
    return query.where((builder) => {
      builder.whereILike('title', searchTerm).orWhereILike('description', searchTerm)
    })
  })

  /**
   * Filter events by type
   * @example CaseEvent.query().withScopes((scopes) => scopes.byType('hearing'))
   */
  static byType = scope((query, type: EventType) => {
    return query.where('event_type', type)
  })

  /**
   * Filter events by multiple types
   * @example CaseEvent.query().withScopes((scopes) => scopes.byTypes(['hearing', 'decision']))
   */
  static byTypes = scope((query, types: EventType[]) => {
    return query.whereIn('event_type', types)
  })

  /**
   * Filter events by source
   * @example CaseEvent.query().withScopes((scopes) => scopes.bySource('court_api'))
   */
  static bySource = scope((query, source: EventSource) => {
    return query.where('source', source)
  })

  /**
   * Filter manual events
   * @example CaseEvent.query().withScopes((scopes) => scopes.manual())
   */
  static manual = scope((query: Builder) => {
    return query.where('source', 'manual')
  })

  /**
   * Filter events from court API
   * @example CaseEvent.query().withScopes((scopes) => scopes.fromCourtApi())
   */
  static fromCourtApi = scope((query: Builder) => {
    return query.where('source', 'court_api')
  })

  /**
   * Filter events from import
   * @example CaseEvent.query().withScopes((scopes) => scopes.imported())
   */
  static imported = scope((query: Builder) => {
    return query.where('source', 'import')
  })

  /**
   * Filter events for a specific case
   * @example CaseEvent.query().withScopes((scopes) => scopes.forCase(caseId))
   */
  static forCase = scope((query, caseId: number) => {
    return query.where('case_id', caseId)
  })

  /**
   * Filter events created by a specific user
   * @example CaseEvent.query().withScopes((scopes) => scopes.createdBy(userId))
   */
  static createdBy = scope((query, userId: number) => {
    return query.where('created_by', userId)
  })

  /**
   * Filter events without creator (system generated)
   * @example CaseEvent.query().withScopes((scopes) => scopes.systemGenerated())
   */
  static systemGenerated = scope((query: Builder) => {
    return query.whereNull('created_by')
  })

  /**
   * Filter events on a specific date
   * @example CaseEvent.query().withScopes((scopes) => scopes.onDate(date))
   */
  static onDate = scope((query, date: DateTime) => {
    const startOfDay = date.startOf('day')
    const endOfDay = date.endOf('day')
    return query.whereBetween('event_date', [startOfDay.toISO()!, endOfDay.toISO()!])
  })

  /**
   * Filter events between dates
   * @example CaseEvent.query().withScopes((scopes) => scopes.betweenDates(from, to))
   */
  static betweenDates = scope((query, from: DateTime, to: DateTime) => {
    return query.whereBetween('event_date', [from.toISO()!, to.toISO()!])
  })

  /**
   * Filter events after date
   * @example CaseEvent.query().withScopes((scopes) => scopes.afterDate(date))
   */
  static afterDate = scope((query, date: DateTime) => {
    return query.where('event_date', '>', date.toISO()!)
  })

  /**
   * Filter events before date
   * @example CaseEvent.query().withScopes((scopes) => scopes.beforeDate(date))
   */
  static beforeDate = scope((query, date: DateTime) => {
    return query.where('event_date', '<', date.toISO()!)
  })

  /**
   * Filter recent events
   * @example CaseEvent.query().withScopes((scopes) => scopes.recent(7))
   */
  static recent = scope((query: Builder, days = 7) => {
    const date = DateTime.now().minus({ days })
    return query.where('event_date', '>=', date.toISO())
  })

  /**
   * Filter upcoming events
   * @example CaseEvent.query().withScopes((scopes) => scopes.upcoming())
   */
  static upcoming = scope((query: Builder) => {
    return query.where('event_date', '>', DateTime.now().toISO())
  })

  /**
   * Filter past events
   * @example CaseEvent.query().withScopes((scopes) => scopes.past())
   */
  static past = scope((query: Builder) => {
    return query.where('event_date', '<', DateTime.now().toISO())
  })

  /**
   * Filter today's events
   * @example CaseEvent.query().withScopes((scopes) => scopes.today())
   */
  static today = scope((query: Builder) => {
    const today = DateTime.now().startOf('day')
    const tomorrow = today.plus({ days: 1 })
    return query.whereBetween('event_date', [today.toISO(), tomorrow.toISO()])
  })

  /**
   * Filter hearings
   * @example CaseEvent.query().withScopes((scopes) => scopes.hearings())
   */
  static hearings = scope((query: Builder) => {
    return query.where('event_type', 'hearing')
  })

  /**
   * Filter decisions
   * @example CaseEvent.query().withScopes((scopes) => scopes.decisions())
   */
  static decisions = scope((query: Builder) => {
    return query.where('event_type', 'decision')
  })

  /**
   * Filter judgments
   * @example CaseEvent.query().withScopes((scopes) => scopes.judgments())
   */
  static judgments = scope((query: Builder) => {
    return query.where('event_type', 'judgment')
  })

  /**
   * Include case relationship
   * @example CaseEvent.query().withScopes((scopes) => scopes.withCase())
   */
  static withCase = scope((query: Builder) => {
    return query.preload('case' as any, (caseQuery: ModelQueryBuilderContract<typeof Case>) => {
      caseQuery.preload('client')
    })
  })

  /**
   * Include creator relationship
   * @example CaseEvent.query().withScopes((scopes) => scopes.withCreator())
   */
  static withCreator = scope((query: Builder) => {
    return (query as any).preload('creator')
  })

  /**
   * Include all relationships
   * @example CaseEvent.query().withScopes((scopes) => scopes.withRelationships())
   */
  static withRelationships = scope((query: ModelQueryBuilderContract<typeof CaseEvent>) => {
    return query
      .preload('case' as any, (q: ModelQueryBuilderContract<typeof Case>) => q.preload('client'))
      .preload('creator')
  })

  /**
   * Order by event date (chronological)
   * @example CaseEvent.query().withScopes((scopes) => scopes.chronological())
   */
  static chronological = scope((query: Builder) => {
    return query.orderBy('event_date', 'asc')
  })

  /**
   * Order by event date (reverse chronological)
   * @example CaseEvent.query().withScopes((scopes) => scopes.reverseChronological())
   */
  static reverseChronological = scope((query: Builder) => {
    return query.orderBy('event_date', 'desc')
  })

  /**
   * Order by creation date (newest first)
   * @example CaseEvent.query().withScopes((scopes) => scopes.newest())
   */
  static newest = scope((query: Builder) => {
    return query.orderBy('created_at', 'desc')
  })

  /**
   * Order by creation date (oldest first)
   * @example CaseEvent.query().withScopes((scopes) => scopes.oldest())
   */
  static oldest = scope((query: Builder) => {
    return query.orderBy('created_at', 'asc')
  })

  /**
   * ------------------------------------------------------
   * Computed Properties
   * ------------------------------------------------------
   */

  /**
   * Returns true if the event was imported from a court API
   */
  @computed()
  get is_from_court(): boolean {
    return this.source === 'court_api'
  }

  /**
   * Returns true if the event was manually created by a user
   */
  @computed()
  get is_manual(): boolean {
    return this.source === 'manual'
  }
}
