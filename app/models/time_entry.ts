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
import User from '#models/user'
import Case from '#models/case'

type Builder = ModelQueryBuilderContract<typeof TimeEntry>

// Create the tenant-scoped mixin
const TenantScoped = withTenantScope()

export default class TimeEntry extends compose(BaseModel, TenantScoped) {
  static table = 'time_entries'
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
  declare case_id: number

  @column.dateTime()
  declare started_at: DateTime

  @column.dateTime()
  declare ended_at: DateTime | null

  @column()
  declare duration_minutes: number | null

  @column()
  declare description: string | null

  @column()
  declare billable: boolean

  @column()
  declare hourly_rate: number | null

  @column()
  declare tags: string[] | null

  @column()
  declare is_deleted: boolean

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
   * Computed Properties
   * ------------------------------------------------------
   */

  /**
   * Calculate billable amount (duration in hours * hourly_rate)
   */
  @computed()
  get amount(): number | null {
    if (!this.duration_minutes || !this.billable || !this.hourly_rate) {
      return null
    }
    const hours = this.duration_minutes / 60
    return Number.parseFloat((hours * this.hourly_rate).toFixed(2))
  }

  /**
   * Duration in hours (decimal)
   */
  @computed()
  get duration_hours(): number | null {
    if (!this.duration_minutes) return null
    return Number.parseFloat((this.duration_minutes / 60).toFixed(2))
  }

  /**
   * Check if timer is currently running
   */
  @computed()
  get is_running(): boolean {
    return !!this.started_at && !this.ended_at
  }

  /**
   * ------------------------------------------------------
   * Query Scopes
   * ------------------------------------------------------
   */

  /**
   * Filter active (not deleted) time entries
   * @example TimeEntry.query().withScopes((scopes) => scopes.active())
   */
  static active = scope((query) => {
    return query.where('is_deleted', false)
  })

  /**
   * Filter completed time entries (with end time)
   * @example TimeEntry.query().withScopes((scopes) => scopes.completed())
   */
  static completed = scope((query) => {
    return query.whereNotNull('ended_at')
  })

  /**
   * Filter running timers (no end time yet)
   * @example TimeEntry.query().withScopes((scopes) => scopes.running())
   */
  static running = scope((query) => {
    return query.whereNull('ended_at')
  })

  /**
   * Filter by billable status
   * @example TimeEntry.query().withScopes((scopes) => scopes.billable(true))
   */
  static billable = scope((query, isBillable: boolean) => {
    return query.where('billable', isBillable)
  })

  /**
   * Filter by case ID
   * @example TimeEntry.query().withScopes((scopes) => scopes.byCase(caseId))
   */
  static byCase = scope((query, caseId: number) => {
    return query.where('case_id', caseId)
  })

  /**
   * Filter by user ID
   * @example TimeEntry.query().withScopes((scopes) => scopes.byUser(userId))
   */
  static byUser = scope((query, userId: number) => {
    return query.where('user_id', userId)
  })

  /**
   * Filter time entries within a date range
   * @example TimeEntry.query().withScopes((scopes) => scopes.inPeriod(from, to))
   */
  static inPeriod = scope((query, from: DateTime, to: DateTime) => {
    return query.whereBetween('started_at', [from.toISO()!, to.toISO()!])
  })

  /**
   * Filter by specific date
   * @example TimeEntry.query().withScopes((scopes) => scopes.onDate(date))
   */
  static onDate = scope((query, date: DateTime) => {
    const startOfDay = date.startOf('day')
    const endOfDay = date.endOf('day')
    return query.whereBetween('started_at', [startOfDay.toISO()!, endOfDay.toISO()!])
  })

  /**
   * Order by start time (newest first)
   * @example TimeEntry.query().withScopes((scopes) => scopes.newest())
   */
  static newest = scope((query) => {
    return query.orderBy('started_at', 'desc')
  })

  /**
   * Order by start time (oldest first)
   * @example TimeEntry.query().withScopes((scopes) => scopes.oldest())
   */
  static oldest = scope((query) => {
    return query.orderBy('started_at', 'asc')
  })

  /**
   * Include user relationship
   * @example TimeEntry.query().withScopes((scopes) => scopes.withUser())
   */
  static withUser = scope((query) => {
    return query.preload('user')
  })

  /**
   * Include case relationship
   * @example TimeEntry.query().withScopes((scopes) => scopes.withCase())
   */
  static withCase = scope((query) => {
    return (query as any).preload('caseRecord')
  })
}
