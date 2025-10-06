import { DateTime } from 'luxon'
import { belongsTo, column, hasMany, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import TenantAwareModel from '#models/tenant_aware_model'
import Client from '#models/client'
import User from '#models/user'
import CaseEvent from '#models/case_event'
import Deadline from '#models/deadline'
import Document from '#models/document'

type CaseType = 'civil' | 'criminal' | 'labor' | 'family' | 'tax' | 'administrative' | 'other'
type CaseStatus = 'active' | 'closed' | 'archived' | 'suspended'
type CasePriority = 'low' | 'medium' | 'high' | 'urgent'

interface CaseParties {
  plaintiffs?: Array<{ name: string; role: string }>
  defendants?: Array<{ name: string; role: string }>
  others?: Array<{ name: string; role: string }>
}

export default class Case extends TenantAwareModel {
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
  declare client_id: number

  @column()
  declare case_number: string | null

  @column()
  declare internal_number: string | null

  @column()
  declare case_type: CaseType

  @column()
  declare court: string | null

  @column()
  declare court_instance: string | null

  @column()
  declare status: CaseStatus

  @column()
  declare priority: CasePriority

  // Responsible parties
  @column()
  declare responsible_lawyer_id: number

  @column({
    prepare: (value: number[] | null) => (value ? `{${value.join(',')}}` : null),
    consume: (value: string | number[] | null) => {
      if (!value) return null
      if (Array.isArray(value)) return value
      return value.replace(/[{}]/g, '').split(',').filter(Boolean).map(Number)
    },
  })
  declare team_members: number[] | null

  // Dates
  @column.date()
  declare filed_at: DateTime | null

  @column.date()
  declare closed_at: DateTime | null

  // Organization
  @column({
    prepare: (value: string[] | null) => (value ? `{${value.join(',')}}` : null),
    consume: (value: string | string[] | null) => {
      if (!value) return null
      if (Array.isArray(value)) return value
      return value.replace(/[{}]/g, '').split(',').filter(Boolean)
    },
  })
  declare tags: string[] | null

  @column()
  declare description: string | null

  @column({
    prepare: (value: Record<string, any> | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | null) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare custom_fields: Record<string, any> | null

  @column({
    prepare: (value: CaseParties | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | null) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare parties: CaseParties | null

  @column()
  declare case_value: number | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  /**
   * ------------------------------------------------------
   * Relationships
   * ------------------------------------------------------
   */
  @belongsTo(() => Client, {
    foreignKey: 'client_id',
  })
  declare client: BelongsTo<typeof Client>

  @belongsTo(() => User, {
    foreignKey: 'responsible_lawyer_id',
  })
  declare responsible_lawyer: BelongsTo<typeof User>

  @hasMany(() => CaseEvent, {
    foreignKey: 'case_id',
  })
  declare events: HasMany<typeof CaseEvent>

  @hasMany(() => Deadline, {
    foreignKey: 'case_id',
  })
  declare deadlines: HasMany<typeof Deadline>

  @hasMany(() => Document, {
    foreignKey: 'case_id',
  })
  declare documents: HasMany<typeof Document>

  /**
   * ------------------------------------------------------
   * Helpers
   * ------------------------------------------------------
   */
  get display_identifier(): string {
    return this.case_number || this.internal_number || `#${this.id}`
  }

  get is_active(): boolean {
    return this.status === 'active'
  }

  get is_urgent(): boolean {
    return this.priority === 'urgent'
  }

  /**
   * ------------------------------------------------------
   * Query Scopes
   * ------------------------------------------------------
   */

  /**
   * Search cases by number, title, or description
   * @example Case.query().withScopes(s => s.search('123456'))
   */
  static search = scope((query, term: string) => {
    if (!term || !term.trim()) return

    const searchTerm = `%${term.trim()}%`
    query.where((builder) => {
      builder
        .whereILike('case_number', searchTerm)
        .orWhereILike('internal_number', searchTerm)
        .orWhereILike('title', searchTerm)
        .orWhereILike('description', searchTerm)
    })
  })

  /**
   * Filter cases by status
   * @example Case.query().withScopes(s => s.byStatus('active'))
   */
  static byStatus = scope((query, status: CaseStatus | CaseStatus[]) => {
    if (Array.isArray(status)) {
      query.whereIn('status', status)
    } else {
      query.where('status', status)
    }
  })

  /**
   * Filter active cases (not closed or archived)
   * @example Case.query().withScopes(s => s.active())
   */
  static active = scope((query) => {
    query.whereIn('status', ['active', 'suspended'])
  })

  /**
   * Filter archived cases
   * @example Case.query().withScopes(s => s.archived())
   */
  static archived = scope((query) => {
    query.where('status', 'archived')
  })

  /**
   * Filter closed cases
   * @example Case.query().withScopes(s => s.closed())
   */
  static closed = scope((query) => {
    query.where('status', 'closed')
  })

  /**
   * Filter urgent cases
   * @example Case.query().withScopes(s => s.urgent())
   */
  static urgent = scope((query) => {
    query.where('priority', 'urgent')
  })

  /**
   * Filter cases by priority
   * @example Case.query().withScopes(s => s.byPriority('high'))
   */
  static byPriority = scope((query, priority: CasePriority) => {
    query.where('priority', priority)
  })

  /**
   * Filter cases by type
   * @example Case.query().withScopes(s => s.byType('civil'))
   */
  static byType = scope((query, type: CaseType) => {
    query.where('case_type', type)
  })

  /**
   * Filter cases by court
   * @example Case.query().withScopes(s => s.byCourt('TJ-SP'))
   */
  static byCourt = scope((query, court: string) => {
    query.where('court', court)
  })

  /**
   * Filter cases assigned to a specific user
   * @example Case.query().withScopes(s => s.assignedTo(userId))
   */
  static assignedTo = scope((query, userId: number) => {
    query.where((builder) => {
      builder.where('responsible_lawyer_id', userId).orWhereRaw('? = ANY(team_members)', [userId])
    })
  })

  /**
   * Filter unassigned cases
   * @example Case.query().withScopes(s => s.unassigned())
   */
  static unassigned = scope((query) => {
    query.whereNull('responsible_lawyer_id')
  })

  /**
   * Filter cases for a specific client
   * @example Case.query().withScopes(s => s.forClient(clientId))
   */
  static forClient = scope((query, clientId: number) => {
    query.where('client_id', clientId)
  })

  /**
   * Filter cases with upcoming deadlines
   * @example Case.query().withScopes(s => s.withUpcomingDeadlines(7))
   */
  static withUpcomingDeadlines = scope((query, days = 7) => {
    const futureDate = DateTime.now().plus({ days }).toSQL()
    query.whereHas('deadlines', (deadlineQuery) => {
      deadlineQuery.where('due_date', '<=', futureDate).whereNull('completed_at')
    })
  })

  /**
   * Filter cases that require attention
   * @example Case.query().withScopes(s => s.requiresAttention())
   */
  static requiresAttention = scope((query) => {
    query.where((builder) => {
      builder
        // Urgent priority
        .where('priority', 'urgent')
        // Or has overdue deadlines
        .orWhereHas('deadlines', (deadlineQuery) => {
          deadlineQuery.where('due_date', '<', DateTime.now().toSQL()).whereNull('completed_at')
        })
        // Or no responsible lawyer
        .orWhereNull('responsible_lawyer_id')
    })
  })

  /**
   * Include case relationships
   * @example Case.query().withScopes(s => s.withRelationships())
   */
  static withRelationships = scope((query) => {
    query
      .preload('client')
      .preload('responsible_lawyer')
      .preload('deadlines', (q) => q.orderBy('due_date', 'asc'))
      .preload('documents', (q) => q.orderBy('created_at', 'desc'))
      .preload('events', (q) => q.orderBy('event_date', 'desc').limit(10))
  })

  /**
   * Include deadlines count
   * @example Case.query().withScopes(s => s.withDeadlinesCount())
   */
  static withDeadlinesCount = scope((query) => {
    query.withCount('deadlines', (q) => {
      q.as('deadlines_count').whereNull('completed_at')
    })
  })

  /**
   * Include documents count
   * @example Case.query().withScopes(s => s.withDocumentsCount())
   */
  static withDocumentsCount = scope((query) => {
    query.withCount('documents', (q) => {
      q.as('documents_count')
    })
  })

  /**
   * Filter cases created between dates
   * @example Case.query().withScopes(s => s.createdBetween(from, to))
   */
  static createdBetween = scope((query, from: DateTime, to: DateTime) => {
    query.whereBetween('created_at', [from.toSQL(), to.toSQL()])
  })

  /**
   * Filter cases by value range
   * @example Case.query().withScopes(s => s.valueBetween(1000, 50000))
   */
  static valueBetween = scope((query, min: number, max: number) => {
    query.whereBetween('case_value', [min, max])
  })

  /**
   * Order by priority (urgent first)
   * @example Case.query().withScopes(s => s.byPriorityOrder())
   */
  static byPriorityOrder = scope((query) => {
    query.orderByRaw(`
      CASE priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
      END ASC
    `)
  })

  /**
   * Order by creation date (newest first)
   * @example Case.query().withScopes(s => s.newest())
   */
  static newest = scope((query) => {
    query.orderBy('created_at', 'desc')
  })

  /**
   * Order by creation date (oldest first)
   * @example Case.query().withScopes(s => s.oldest())
   */
  static oldest = scope((query) => {
    query.orderBy('created_at', 'asc')
  })
}
