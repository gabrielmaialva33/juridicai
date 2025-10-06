import { DateTime } from 'luxon'
import { belongsTo, column, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import TenantAwareModel from '#models/tenant_aware_model'
import Case from '#models/case'
import User from '#models/user'

type DeadlineStatus = 'pending' | 'completed' | 'expired' | 'cancelled'

interface AlertConfig {
  days_before?: number[]
  email_enabled?: boolean
  sms_enabled?: boolean
  push_enabled?: boolean
  recipients?: number[]
}

export default class Deadline extends TenantAwareModel {
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

  // Relationships
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
   * Helper: Check if deadline is overdue
   */
  get is_overdue(): boolean {
    if (this.status !== 'pending') return false
    return this.deadline_date < DateTime.now()
  }

  /**
   * Helper: Days until deadline
   */
  get days_until_deadline(): number {
    return Math.ceil(this.deadline_date.diff(DateTime.now(), 'days').days)
  }

  /**
   * Helper: Is approaching (within 7 days)
   */
  get is_approaching(): boolean {
    const days = this.days_until_deadline
    return days <= 7 && days > 0 && this.status === 'pending'
  }

  /**
   * ------------------------------------------------------
   * Query Scopes
   * ------------------------------------------------------
   */

  /**
   * Search deadlines by title or description
   * @example Deadline.query().withScopes(s => s.search('payment'))
   */
  static search = scope((query: ModelQueryBuilderContract<typeof Deadline>, term: string) => {
    if (!term || !term.trim()) return

    const searchTerm = `%${term.trim()}%`
    query.where((builder) => {
      builder.whereILike('title', searchTerm).orWhereILike('description', searchTerm)
    })
  })

  /**
   * Filter deadlines by status
   * @example Deadline.query().withScopes(s => s.byStatus('pending'))
   */
  static byStatus = scope(
    (query: ModelQueryBuilderContract<typeof Deadline>, status: DeadlineStatus) => {
      query.where('status', status)
    }
  )

  /**
   * Filter pending deadlines
   * @example Deadline.query().withScopes(s => s.pending())
   */
  static pending = scope((query: ModelQueryBuilderContract<typeof Deadline>) => {
    query.where('status', 'pending')
  })

  /**
   * Filter completed deadlines
   * @example Deadline.query().withScopes(s => s.completed())
   */
  static completed = scope((query: ModelQueryBuilderContract<typeof Deadline>) => {
    query.where('status', 'completed')
  })

  /**
   * Filter expired deadlines
   * @example Deadline.query().withScopes(s => s.expired())
   */
  static expired = scope((query: ModelQueryBuilderContract<typeof Deadline>) => {
    query.where('status', 'expired')
  })

  /**
   * Filter overdue deadlines
   * @example Deadline.query().withScopes(s => s.overdue())
   */
  static overdue = scope((query: ModelQueryBuilderContract<typeof Deadline>) => {
    query.where('status', 'pending').where('deadline_date', '<', DateTime.now().toSQL())
  })

  /**
   * Filter upcoming deadlines within N days
   * @example Deadline.query().withScopes(s => s.upcoming(7))
   */
  static upcoming = scope((query: ModelQueryBuilderContract<typeof Deadline>, days = 7) => {
    const futureDate = DateTime.now().plus({ days })
    query
      .where('status', 'pending')
      .where('deadline_date', '>=', DateTime.now().toSQL())
      .where('deadline_date', '<=', futureDate.toSQL())
  })

  /**
   * Filter approaching deadlines (within 7 days)
   * @example Deadline.query().withScopes(s => s.approaching())
   */
  static approaching = scope((query: ModelQueryBuilderContract<typeof Deadline>) => {
    const futureDate = DateTime.now().plus({ days: 7 })
    query
      .where('status', 'pending')
      .where('deadline_date', '>', DateTime.now().toSQL())
      .where('deadline_date', '<=', futureDate.toSQL())
  })

  /**
   * Filter today's deadlines
   * @example Deadline.query().withScopes(s => s.dueToday())
   */
  static dueToday = scope((query: ModelQueryBuilderContract<typeof Deadline>) => {
    const today = DateTime.now().startOf('day')
    const tomorrow = today.plus({ days: 1 })
    query
      .where('status', 'pending')
      .where('deadline_date', '>=', today.toSQL())
      .where('deadline_date', '<', tomorrow.toSQL())
  })

  /**
   * Filter fatal deadlines
   * @example Deadline.query().withScopes(s => s.fatal())
   */
  static fatal = scope((query: ModelQueryBuilderContract<typeof Deadline>) => {
    query.where('is_fatal', true)
  })

  /**
   * Filter non-fatal deadlines
   * @example Deadline.query().withScopes(s => s.nonFatal())
   */
  static nonFatal = scope((query: ModelQueryBuilderContract<typeof Deadline>) => {
    query.where('is_fatal', false)
  })

  /**
   * Filter deadlines for a specific case
   * @example Deadline.query().withScopes(s => s.forCase(caseId))
   */
  static forCase = scope((query: ModelQueryBuilderContract<typeof Deadline>, caseId: number) => {
    query.where('case_id', caseId)
  })

  /**
   * Filter deadlines assigned to a specific user
   * @example Deadline.query().withScopes(s => s.assignedTo(userId))
   */
  static assignedTo = scope((query: ModelQueryBuilderContract<typeof Deadline>, userId: number) => {
    query.where('responsible_id', userId)
  })

  /**
   * Filter deadlines completed by a specific user
   * @example Deadline.query().withScopes(s => s.completedBy(userId))
   */
  static completedBy = scope(
    (query: ModelQueryBuilderContract<typeof Deadline>, userId: number) => {
      query.where('completed_by', userId)
    }
  )

  /**
   * Filter deadlines that need alerts
   * @example Deadline.query().withScopes(s => s.needsAlert())
   */
  static needsAlert = scope((query: ModelQueryBuilderContract<typeof Deadline>) => {
    query
      .where('status', 'pending')
      .whereNotNull('alert_config')
      .where((builder) => {
        builder
          .whereNull('last_alert_sent_at')
          .orWhere('last_alert_sent_at', '<', DateTime.now().minus({ hours: 24 }).toSQL())
      })
  })

  /**
   * Filter deadlines between dates
   * @example Deadline.query().withScopes(s => s.dueBetween(from, to))
   */
  static dueBetween = scope(
    (query: ModelQueryBuilderContract<typeof Deadline>, from: DateTime, to: DateTime) => {
      query.whereBetween('deadline_date', [from.toSQL(), to.toSQL()])
    }
  )

  /**
   * Filter deadlines completed between dates
   * @example Deadline.query().withScopes(s => s.completedBetween(from, to))
   */
  static completedBetween = scope(
    (query: ModelQueryBuilderContract<typeof Deadline>, from: DateTime, to: DateTime) => {
      query.whereBetween('completed_at', [from.toSQL(), to.toSQL()])
    }
  )

  /**
   * Filter recently completed deadlines
   * @example Deadline.query().withScopes(s => s.recentlyCompleted(7))
   */
  static recentlyCompleted = scope(
    (query: ModelQueryBuilderContract<typeof Deadline>, days = 7) => {
      const date = DateTime.now().minus({ days })
      query.where('status', 'completed').where('completed_at', '>=', date.toSQL())
    }
  )

  /**
   * Include case relationship
   * @example Deadline.query().withScopes(s => s.withCase())
   */
  static withCase = scope((query: ModelQueryBuilderContract<typeof Deadline>) => {
    query.preload('case', (caseQuery) => {
      caseQuery.preload('client')
    })
  })

  /**
   * Include responsible user relationship
   * @example Deadline.query().withScopes(s => s.withResponsible())
   */
  static withResponsible = scope((query: ModelQueryBuilderContract<typeof Deadline>) => {
    query.preload('responsible')
  })

  /**
   * Include all relationships
   * @example Deadline.query().withScopes(s => s.withRelationships())
   */
  static withRelationships = scope((query: ModelQueryBuilderContract<typeof Deadline>) => {
    query
      .preload('case', (q) => q.preload('client'))
      .preload('responsible')
      .preload('completed_by_user')
  })

  /**
   * Order by deadline date (earliest first)
   * @example Deadline.query().withScopes(s => s.byDeadlineOrder())
   */
  static byDeadlineOrder = scope((query: ModelQueryBuilderContract<typeof Deadline>) => {
    query.orderBy('deadline_date', 'asc')
  })

  /**
   * Order by priority (fatal first, then by date)
   * @example Deadline.query().withScopes(s => s.byPriority())
   */
  static byPriority = scope((query: ModelQueryBuilderContract<typeof Deadline>) => {
    query.orderBy('is_fatal', 'desc').orderBy('deadline_date', 'asc')
  })

  /**
   * Order by creation date (newest first)
   * @example Deadline.query().withScopes(s => s.newest())
   */
  static newest = scope((query: ModelQueryBuilderContract<typeof Deadline>) => {
    query.orderBy('created_at', 'desc')
  })

  /**
   * Order by creation date (oldest first)
   * @example Deadline.query().withScopes(s => s.oldest())
   */
  static oldest = scope((query: ModelQueryBuilderContract<typeof Deadline>) => {
    query.orderBy('created_at', 'asc')
  })
}
