import { DateTime } from 'luxon'
import { belongsTo, column, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import TenantAwareModel from '#models/tenant_aware_model'
import Case from '#models/case'
import User from '#models/user'

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

export default class CaseEvent extends TenantAwareModel {
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
    consume: (value: string | null) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare metadata: Record<string, any> | null

  @column()
  declare created_by: number | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // Relationships
  @belongsTo(() => Case, {
    foreignKey: 'case_id',
  })
  declare case: BelongsTo<typeof Case>

  @belongsTo(() => User, {
    foreignKey: 'created_by',
  })
  declare creator: BelongsTo<typeof User>

  /**
   * Helper: Check if event is from court API
   */
  get is_from_court(): boolean {
    return this.source === 'court_api'
  }

  /**
   * Helper: Check if event is manual
   */
  get is_manual(): boolean {
    return this.source === 'manual'
  }

  /**
   * ------------------------------------------------------
   * Query Scopes
   * ------------------------------------------------------
   */

  /**
   * Search events by title or description
   * @example CaseEvent.query().withScopes(s => s.search('hearing'))
   */
  static search = scope((query: ModelQueryBuilderContract<typeof CaseEvent>, term: string) => {
    if (!term || !term.trim()) return

    const searchTerm = `%${term.trim()}%`
    query.where((builder) => {
      builder.whereILike('title', searchTerm).orWhereILike('description', searchTerm)
    })
  })

  /**
   * Filter events by type
   * @example CaseEvent.query().withScopes(s => s.byType('hearing'))
   */
  static byType = scope((query: ModelQueryBuilderContract<typeof CaseEvent>, type: EventType) => {
    query.where('event_type', type)
  })

  /**
   * Filter events by multiple types
   * @example CaseEvent.query().withScopes(s => s.byTypes(['hearing', 'decision']))
   */
  static byTypes = scope(
    (query: ModelQueryBuilderContract<typeof CaseEvent>, types: EventType[]) => {
      query.whereIn('event_type', types)
    }
  )

  /**
   * Filter events by source
   * @example CaseEvent.query().withScopes(s => s.bySource('court_api'))
   */
  static bySource = scope(
    (query: ModelQueryBuilderContract<typeof CaseEvent>, source: EventSource) => {
      query.where('source', source)
    }
  )

  /**
   * Filter manual events
   * @example CaseEvent.query().withScopes(s => s.manual())
   */
  static manual = scope((query: ModelQueryBuilderContract<typeof CaseEvent>) => {
    query.where('source', 'manual')
  })

  /**
   * Filter events from court API
   * @example CaseEvent.query().withScopes(s => s.fromCourtApi())
   */
  static fromCourtApi = scope((query: ModelQueryBuilderContract<typeof CaseEvent>) => {
    query.where('source', 'court_api')
  })

  /**
   * Filter events from import
   * @example CaseEvent.query().withScopes(s => s.imported())
   */
  static imported = scope((query: ModelQueryBuilderContract<typeof CaseEvent>) => {
    query.where('source', 'import')
  })

  /**
   * Filter events for a specific case
   * @example CaseEvent.query().withScopes(s => s.forCase(caseId))
   */
  static forCase = scope((query: ModelQueryBuilderContract<typeof CaseEvent>, caseId: number) => {
    query.where('case_id', caseId)
  })

  /**
   * Filter events created by a specific user
   * @example CaseEvent.query().withScopes(s => s.createdBy(userId))
   */
  static createdBy = scope((query: ModelQueryBuilderContract<typeof CaseEvent>, userId: number) => {
    query.where('created_by', userId)
  })

  /**
   * Filter events without creator (system generated)
   * @example CaseEvent.query().withScopes(s => s.systemGenerated())
   */
  static systemGenerated = scope((query: ModelQueryBuilderContract<typeof CaseEvent>) => {
    query.whereNull('created_by')
  })

  /**
   * Filter events on a specific date
   * @example CaseEvent.query().withScopes(s => s.onDate(date))
   */
  static onDate = scope((query: ModelQueryBuilderContract<typeof CaseEvent>, date: DateTime) => {
    const startOfDay = date.startOf('day')
    const endOfDay = date.endOf('day')
    query.whereBetween('event_date', [startOfDay.toSQL(), endOfDay.toSQL()])
  })

  /**
   * Filter events between dates
   * @example CaseEvent.query().withScopes(s => s.betweenDates(from, to))
   */
  static betweenDates = scope(
    (query: ModelQueryBuilderContract<typeof CaseEvent>, from: DateTime, to: DateTime) => {
      query.whereBetween('event_date', [from.toSQL(), to.toSQL()])
    }
  )

  /**
   * Filter events after date
   * @example CaseEvent.query().withScopes(s => s.afterDate(date))
   */
  static afterDate = scope((query: ModelQueryBuilderContract<typeof CaseEvent>, date: DateTime) => {
    query.where('event_date', '>', date.toSQL())
  })

  /**
   * Filter events before date
   * @example CaseEvent.query().withScopes(s => s.beforeDate(date))
   */
  static beforeDate = scope(
    (query: ModelQueryBuilderContract<typeof CaseEvent>, date: DateTime) => {
      query.where('event_date', '<', date.toSQL())
    }
  )

  /**
   * Filter recent events
   * @example CaseEvent.query().withScopes(s => s.recent(7))
   */
  static recent = scope((query: ModelQueryBuilderContract<typeof CaseEvent>, days = 7) => {
    const date = DateTime.now().minus({ days })
    query.where('event_date', '>=', date.toSQL())
  })

  /**
   * Filter upcoming events
   * @example CaseEvent.query().withScopes(s => s.upcoming())
   */
  static upcoming = scope((query: ModelQueryBuilderContract<typeof CaseEvent>) => {
    query.where('event_date', '>', DateTime.now().toSQL())
  })

  /**
   * Filter past events
   * @example CaseEvent.query().withScopes(s => s.past())
   */
  static past = scope((query: ModelQueryBuilderContract<typeof CaseEvent>) => {
    query.where('event_date', '<', DateTime.now().toSQL())
  })

  /**
   * Filter today's events
   * @example CaseEvent.query().withScopes(s => s.today())
   */
  static today = scope((query: ModelQueryBuilderContract<typeof CaseEvent>) => {
    const today = DateTime.now().startOf('day')
    const tomorrow = today.plus({ days: 1 })
    query.whereBetween('event_date', [today.toSQL(), tomorrow.toSQL()])
  })

  /**
   * Filter hearings
   * @example CaseEvent.query().withScopes(s => s.hearings())
   */
  static hearings = scope((query: ModelQueryBuilderContract<typeof CaseEvent>) => {
    query.where('event_type', 'hearing')
  })

  /**
   * Filter decisions
   * @example CaseEvent.query().withScopes(s => s.decisions())
   */
  static decisions = scope((query: ModelQueryBuilderContract<typeof CaseEvent>) => {
    query.where('event_type', 'decision')
  })

  /**
   * Filter judgments
   * @example CaseEvent.query().withScopes(s => s.judgments())
   */
  static judgments = scope((query: ModelQueryBuilderContract<typeof CaseEvent>) => {
    query.where('event_type', 'judgment')
  })

  /**
   * Include case relationship
   * @example CaseEvent.query().withScopes(s => s.withCase())
   */
  static withCase = scope((query: ModelQueryBuilderContract<typeof CaseEvent>) => {
    query.preload('case', (caseQuery) => {
      caseQuery.preload('client')
    })
  })

  /**
   * Include creator relationship
   * @example CaseEvent.query().withScopes(s => s.withCreator())
   */
  static withCreator = scope((query: ModelQueryBuilderContract<typeof CaseEvent>) => {
    query.preload('creator')
  })

  /**
   * Include all relationships
   * @example CaseEvent.query().withScopes(s => s.withRelationships())
   */
  static withRelationships = scope((query: ModelQueryBuilderContract<typeof CaseEvent>) => {
    query.preload('case', (q) => q.preload('client')).preload('creator')
  })

  /**
   * Order by event date (chronological)
   * @example CaseEvent.query().withScopes(s => s.chronological())
   */
  static chronological = scope((query: ModelQueryBuilderContract<typeof CaseEvent>) => {
    query.orderBy('event_date', 'asc')
  })

  /**
   * Order by event date (reverse chronological)
   * @example CaseEvent.query().withScopes(s => s.reverseChronological())
   */
  static reverseChronological = scope((query: ModelQueryBuilderContract<typeof CaseEvent>) => {
    query.orderBy('event_date', 'desc')
  })

  /**
   * Order by creation date (newest first)
   * @example CaseEvent.query().withScopes(s => s.newest())
   */
  static newest = scope((query: ModelQueryBuilderContract<typeof CaseEvent>) => {
    query.orderBy('created_at', 'desc')
  })

  /**
   * Order by creation date (oldest first)
   * @example CaseEvent.query().withScopes(s => s.oldest())
   */
  static oldest = scope((query: ModelQueryBuilderContract<typeof CaseEvent>) => {
    query.orderBy('created_at', 'asc')
  })
}
