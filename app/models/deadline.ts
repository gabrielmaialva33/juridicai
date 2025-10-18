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

type Builder = ModelQueryBuilderContract<typeof Deadline>

type DeadlineStatus = 'pending' | 'completed' | 'expired' | 'cancelled'

interface AlertConfig {
  days_before?: number[]
  email_enabled?: boolean
  sms_enabled?: boolean
  push_enabled?: boolean
  recipients?: number[]
}

// Create the tenant-scoped mixin
const TenantScoped = withTenantScope()

export default class Deadline extends compose(BaseModel, TenantScoped) {
  static table = 'deadlines'
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
  declare responsible_id: number

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column.date()
  declare deadline_date: DateTime

  @column.date()
  declare internal_deadline_date: DateTime | null

  @column()
  declare is_fatal: boolean

  @column()
  declare status: DeadlineStatus

  @column({
    prepare: (value: AlertConfig | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | null) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare alert_config: AlertConfig | null

  @column.dateTime()
  declare last_alert_sent_at: DateTime | null

  @column.dateTime()
  declare completed_at: DateTime | null

  @column()
  declare completed_by: number | null

  @column()
  declare completion_notes: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  /**
   * ------------------------------------------------------
   * Relationships
   * ------------------------------------------------------
   */
  @belongsTo(() => Case, {
    foreignKey: 'case_id',
  })
  declare case: BelongsTo<typeof Case>

  @belongsTo(() => User, {
    foreignKey: 'responsible_id',
  })
  declare responsible: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'completed_by',
  })
  declare completed_by_user: BelongsTo<typeof User>

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
   * Search deadlines by title or description
   * @example Deadline.query().withScopes((scopes) => scopes.search('payment'))
   */
  static search = scope((query, term: string) => {
    if (!term || !term.trim()) return query

    const searchTerm = `%${term.trim()}%`
    return query.where((builder) => {
      builder.whereILike('title', searchTerm).orWhereILike('description', searchTerm)
    })
  })

  /**
   * Filter deadlines by status
   * @example Deadline.query().withScopes((scopes) => scopes.byStatus('pending'))
   */
  static byStatus = scope((query, status: DeadlineStatus) => {
    return query.where('status', status)
  })

  /**
   * Filter pending deadlines
   * @example Deadline.query().withScopes((scopes) => scopes.pending())
   */
  static pending = scope((query: Builder) => {
    return query.where('status', 'pending')
  })

  /**
   * Filter completed deadlines
   * @example Deadline.query().withScopes((scopes) => scopes.completed())
   */
  static completed = scope((query: Builder) => {
    return query.where('status', 'completed')
  })

  /**
   * Filter expired deadlines
   * @example Deadline.query().withScopes((scopes) => scopes.expired())
   */
  static expired = scope((query: Builder) => {
    return query.where('status', 'expired')
  })

  /**
   * Filter overdue deadlines
   * @example Deadline.query().withScopes((scopes) => scopes.overdue())
   */
  static overdue = scope((query: Builder) => {
    return query.where('status', 'pending').where('deadline_date', '<', DateTime.now().toISO())
  })

  /**
   * Filter upcoming deadlines within N days
   * @example Deadline.query().withScopes((scopes) => scopes.upcoming(7))
   */
  static upcoming = scope((query: Builder, days = 7) => {
    const futureDate = DateTime.now().plus({ days })
    return query
      .where('status', 'pending')
      .where('deadline_date', '>=', DateTime.now().toISO())
      .where('deadline_date', '<=', futureDate.toISO())
  })

  /**
   * Filter approaching deadlines (within 7 days)
   * @example Deadline.query().withScopes((scopes) => scopes.approaching())
   */
  static approaching = scope((query: Builder) => {
    const futureDate = DateTime.now().plus({ days: 7 })
    return query
      .where('status', 'pending')
      .where('deadline_date', '>', DateTime.now().toISO())
      .where('deadline_date', '<=', futureDate.toISO())
  })

  /**
   * Filter today's deadlines
   * @example Deadline.query().withScopes((scopes) => scopes.dueToday())
   */
  static dueToday = scope((query: Builder) => {
    const today = DateTime.now().startOf('day')
    const tomorrow = today.plus({ days: 1 })
    return query
      .where('status', 'pending')
      .where('deadline_date', '>=', today.toISO())
      .where('deadline_date', '<', tomorrow.toISO())
  })

  /**
   * Filter fatal deadlines
   * @example Deadline.query().withScopes((scopes) => scopes.fatal())
   */
  static fatal = scope((query: Builder) => {
    return query.where('is_fatal', true)
  })

  /**
   * Filter non-fatal deadlines
   * @example Deadline.query().withScopes((scopes) => scopes.nonFatal())
   */
  static nonFatal = scope((query: Builder) => {
    return query.where('is_fatal', false)
  })

  /**
   * Filter deadlines for a specific case
   * @example Deadline.query().withScopes((scopes) => scopes.forCase(caseId))
   */
  static forCase = scope((query, caseId: number) => {
    return query.where('case_id', caseId)
  })

  /**
   * Filter deadlines assigned to a specific user
   * @example Deadline.query().withScopes((scopes) => scopes.assignedTo(userId))
   */
  static assignedTo = scope((query, userId: number) => {
    return query.where('responsible_id', userId)
  })

  /**
   * Filter deadlines completed by a specific user
   * @example Deadline.query().withScopes((scopes) => scopes.completedBy(userId))
   */
  static completedBy = scope((query, userId: number) => {
    return query.where('completed_by', userId)
  })

  /**
   * Filter deadlines that need alerts
   * @example Deadline.query().withScopes((scopes) => scopes.needsAlert())
   */
  static needsAlert = scope((query: Builder) => {
    return query
      .where('status', 'pending')
      .whereNotNull('alert_config')
      .where((builder) => {
        builder
          .whereNull('last_alert_sent_at')
          .orWhere('last_alert_sent_at', '<', DateTime.now().minus({ hours: 24 }).toISO())
      })
  })

  /**
   * Filter deadlines between dates
   * @example Deadline.query().withScopes((scopes) => scopes.dueBetween(from, to))
   */
  static dueBetween = scope((query, from: DateTime, to: DateTime) => {
    return query.whereBetween('deadline_date', [from.toISO()!, to.toISO()!])
  })

  /**
   * Filter deadlines completed between dates
   * @example Deadline.query().withScopes((scopes) => scopes.completedBetween(from, to))
   */
  static completedBetween = scope((query, from: DateTime, to: DateTime) => {
    return query.whereBetween('completed_at', [from.toISO()!, to.toISO()!])
  })

  /**
   * Filter recently completed deadlines
   * @example Deadline.query().withScopes((scopes) => scopes.recentlyCompleted(7))
   */
  static recentlyCompleted = scope((query: Builder, days = 7) => {
    const date = DateTime.now().minus({ days })
    return query.where('status', 'completed').where('completed_at', '>=', date.toISO())
  })

  /**
   * Include case relationship
   * @example Deadline.query().withScopes((scopes) => scopes.withCase())
   */
  static withCase = scope((query) => {
    return query.preload('case', (caseQuery: any) => {
      caseQuery.preload('client')
    })
  })

  /**
   * Include responsible user relationship
   * @example Deadline.query().withScopes((scopes) => scopes.withResponsible())
   */
  static withResponsible = scope((query) => {
    return query.preload('responsible')
  })

  /**
   * Include all relationships
   * @example Deadline.query().withScopes((scopes) => scopes.withRelationships())
   */
  static withRelationships = scope((query) => {
    return query
      .preload('case', (q: any) => q.preload('client'))
      .preload('responsible')
      .preload('completed_by_user')
  })

  /**
   * Order by deadline date (earliest first)
   * @example Deadline.query().withScopes((scopes) => scopes.byDeadlineOrder())
   */
  static byDeadlineOrder = scope((query: Builder) => {
    return query.orderBy('deadline_date', 'asc')
  })

  /**
   * Order by priority (fatal first, then by date)
   * @example Deadline.query().withScopes((scopes) => scopes.byPriority())
   */
  static byPriority = scope((query: Builder) => {
    return query.orderBy('is_fatal', 'desc').orderBy('deadline_date', 'asc')
  })

  /**
   * Order by creation date (newest first)
   * @example Deadline.query().withScopes((scopes) => scopes.newest())
   */
  static newest = scope((query: Builder) => {
    return query.orderBy('created_at', 'desc')
  })

  /**
   * Order by creation date (oldest first)
   * @example Deadline.query().withScopes((scopes) => scopes.oldest())
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
   * Returns true if the deadline is overdue
   * Only applies to pending deadlines
   */
  @computed()
  get is_overdue(): boolean {
    if (this.status !== 'pending' || !this.deadline_date) return false
    return this.deadline_date < DateTime.now()
  }

  /**
   * Returns the number of days until the deadline
   * Positive values mean deadline is in the future
   * Negative values mean deadline has passed
   */
  @computed()
  get days_until_deadline(): number {
    if (!this.deadline_date) return 0
    return Math.ceil(this.deadline_date.diff(DateTime.now(), 'days').days)
  }

  /**
   * Returns true if the deadline is approaching (within 7 days)
   * Only applies to pending deadlines with future dates
   */
  @computed()
  get is_approaching(): boolean {
    const days = this.days_until_deadline
    return days <= 7 && days > 0 && this.status === 'pending'
  }
}
