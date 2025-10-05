import { DateTime } from 'luxon'
import { belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
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
    consume: (value: string | null) => {
      if (!value) return null
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
    consume: (value: string | null) => {
      if (!value) return null
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
}
