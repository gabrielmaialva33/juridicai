import { DateTime } from 'luxon'
import { column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
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
    consume: (value: string | null) => (value ? JSON.parse(value) : null),
  })
  declare metadata: Record<string, any> | null

  @column()
  declare created_by: number | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // Relationships
  @belongsTo(() => Case)
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
}
