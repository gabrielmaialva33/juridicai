import { DateTime } from 'luxon'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
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
    consume: (value: string | null) => (value ? JSON.parse(value) : null),
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
  @belongsTo(() => Case)
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
}
