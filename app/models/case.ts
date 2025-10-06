import { DateTime } from 'luxon'
import {
  BaseModel,
  belongsTo,
  column,
  hasMany,
  scope,
  SnakeCaseNamingStrategy,
} from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

import TenantContextService from '#services/tenants/tenant_context_service'
import Client from '#models/client'
import User from '#models/user'
import CaseEvent from '#models/case_event'
import Deadline from '#models/deadline'
import Document from '#models/document'

type Builder = ModelQueryBuilderContract<typeof Case>

type CaseType = 'civil' | 'criminal' | 'labor' | 'family' | 'tax' | 'administrative' | 'other'
type CaseStatus = 'active' | 'closed' | 'archived' | 'suspended'
type CasePriority = 'low' | 'medium' | 'high' | 'urgent'

interface CaseParties {
  plaintiffs?: Array<{ name: string; role: string }>
  defendants?: Array<{ name: string; role: string }>
  others?: Array<{ name: string; role: string }>
}

export default class Case extends BaseModel {
  static table = 'cases'
  static namingStrategy = new SnakeCaseNamingStrategy()

  static boot() {
    if (this.booted) return
    super.boot()

    // Hook para auto-set tenant_id
    this.before('create', (model: Case) => {
      if (!model.tenant_id) {
        model.tenant_id = TenantContextService.assertTenantId()
      }
    })

    // Hook para auto-filter queries
    this.before('find', (query) => {
      const tenantId = TenantContextService.getCurrentTenantId()
      if (tenantId && !(query as any)._skipTenantScope) {
        query.where('tenant_id', tenantId)
      }
    })

    this.before('fetch', (query) => {
      const tenantId = TenantContextService.getCurrentTenantId()
      if (tenantId && !(query as any)._skipTenantScope) {
        query.where('tenant_id', tenantId)
      }
    })
  }

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

  @column.date()
  declare filed_at: DateTime | null

  @column.date()
  declare closed_at: DateTime | null

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
    consume: (value: string | null) => (value ? JSON.parse(value) : null),
  })
  declare custom_fields: Record<string, any> | null

  @column({
    prepare: (value: CaseParties | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | null) => (value ? JSON.parse(value) : null),
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
  @belongsTo(() => Client, { foreignKey: 'client_id' })
  declare client: BelongsTo<typeof Client>

  @belongsTo(() => User, { foreignKey: 'responsible_lawyer_id' })
  declare responsible_lawyer: BelongsTo<typeof User>

  @hasMany(() => CaseEvent, { foreignKey: 'case_id' })
  declare events: HasMany<typeof CaseEvent>

  @hasMany(() => Deadline, { foreignKey: 'case_id' })
  declare deadlines: HasMany<typeof Deadline>

  @hasMany(() => Document, { foreignKey: 'case_id' })
  declare documents: HasMany<typeof Document>

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
   * Scope to filter by specific tenant
   * @example Case.query().withScopes((scopes) => scopes.forTenant(tenantId))
   */
  static forTenant = scope((query, tenantId: string) => {
    return query.where('tenant_id', tenantId)
  })

  /**
   * Scope to disable automatic tenant filtering
   * USE WITH CAUTION - only for admin operations
   * @example Case.query().withScopes((scopes) => scopes.withoutTenantScope())
   */
  static withoutTenantScope = scope((query) => {
    ;(query as any)._skipTenantScope = true
    return query
  })

  /**
   * Search cases by number, title, or description
   * @example Case.query().withScopes((scopes) => scopes.search('123456'))
   */
  static search = scope((query, term: string) => {
    if (!term || !term.trim()) return query

    const searchTerm = `%${term.trim()}%`
    return query.where((builder) => {
      builder
        .whereILike('case_number', searchTerm)
        .orWhereILike('internal_number', searchTerm)
        .orWhereILike('description', searchTerm)
    })
  })

  /**
   * Filter cases by status
   * @example Case.query().withScopes((scopes) => scopes.byStatus('active'))
   */
  static byStatus = scope((query, status: CaseStatus | CaseStatus[]) => {
    if (Array.isArray(status)) {
      return query.whereIn('status', status)
    } else {
      return query.where('status', status)
    }
  })

  /**
   * Filter active cases (not closed or archived)
   * @example Case.query().withScopes((scopes) => scopes.active())
   */
  static active = scope((query: Builder) => {
    return query.whereIn('status', ['active', 'suspended'])
  })

  /**
   * Filter archived cases
   * @example Case.query().withScopes((scopes) => scopes.archived())
   */
  static archived = scope((query: Builder) => {
    return query.where('status', 'archived')
  })

  /**
   * Filter closed cases
   * @example Case.query().withScopes((scopes) => scopes.closed())
   */
  static closed = scope((query: Builder) => {
    return query.where('status', 'closed')
  })

  /**
   * Filter urgent cases
   * @example Case.query().withScopes((scopes) => scopes.urgent())
   */
  static urgent = scope((query: Builder) => {
    return query.where('priority', 'urgent')
  })

  /**
   * Filter cases by priority
   * @example Case.query().withScopes((scopes) => scopes.byPriority('high'))
   */
  static byPriority = scope((query, priority: CasePriority) => {
    return query.where('priority', priority)
  })

  /**
   * Filter cases by type
   * @example Case.query().withScopes((scopes) => scopes.byType('civil'))
   */
  static byType = scope((query, type: CaseType) => {
    return query.where('case_type', type)
  })

  /**
   * Filter cases by court
   * @example Case.query().withScopes((scopes) => scopes.byCourt('TJ-SP'))
   */
  static byCourt = scope((query, court: string) => {
    return query.where('court', court)
  })

  /**
   * Filter cases assigned to a specific user
   * @example Case.query().withScopes((scopes) => scopes.assignedTo(userId))
   */
  static assignedTo = scope((query, userId: number) => {
    return query.where((builder) => {
      builder.where('responsible_lawyer_id', userId).orWhereRaw('? = ANY(team_members)', [userId])
    })
  })

  /**
   * Filter unassigned cases
   * @example Case.query().withScopes((scopes) => scopes.unassigned())
   */
  static unassigned = scope((query: Builder) => {
    return query.whereNull('responsible_lawyer_id')
  })

  /**
   * Filter cases for a specific client
   * @example Case.query().withScopes((scopes) => scopes.forClient(clientId))
   */
  static forClient = scope((query, clientId: number) => {
    return query.where('client_id', clientId)
  })

  /**
   * Filter cases with upcoming deadlines
   * @example Case.query().withScopes((scopes) => scopes.withUpcomingDeadlines(7))
   */
  static withUpcomingDeadlines = scope((query: Builder, days = 7) => {
    const futureDate = DateTime.now().plus({ days }).toISO()
    return query.whereHas('deadlines', (deadlineQuery) => {
      deadlineQuery.where('due_date', '<=', futureDate!).whereNull('completed_at')
    })
  })

  /**
   * Filter cases that require attention
   * @example Case.query().withScopes((scopes) => scopes.requiresAttention())
   */
  static requiresAttention = scope((query: Builder) => {
    return query.where((builder) => {
      builder
        // Urgent priority
        .where('priority', 'urgent')
        // Or has overdue deadlines
        .orWhereHas('deadlines', (deadlineQuery) => {
          deadlineQuery.where('due_date', '<', DateTime.now().toISO()!).whereNull('completed_at')
        })
        // Or no responsible lawyer
        .orWhereNull('responsible_lawyer_id')
    })
  })

  /**
   * Include case relationships
   * @example Case.query().withScopes((scopes) => scopes.withRelationships())
   */
  static withRelationships = scope((query: Builder) => {
    return query
      .preload('client')
      .preload('responsible_lawyer')
      .preload('deadlines', (q) => q.orderBy('due_date', 'asc'))
      .preload('documents', (q) => q.orderBy('created_at', 'desc'))
      .preload('events', (q) => q.orderBy('event_date', 'desc').limit(10))
  })

  /**
   * Include deadlines count
   * @example Case.query().withScopes((scopes) => scopes.withDeadlinesCount())
   */
  static withDeadlinesCount = scope((query: Builder) => {
    return query.withCount('deadlines', (q) => {
      q.as('deadlines_count').whereNull('completed_at')
    })
  })

  /**
   * Include documents count
   * @example Case.query().withScopes((scopes) => scopes.withDocumentsCount())
   */
  static withDocumentsCount = scope((query: Builder) => {
    return query.withCount('documents', (q) => {
      q.as('documents_count')
    })
  })

  /**
   * Filter cases created between dates
   * @example Case.query().withScopes((scopes) => scopes.createdBetween(from, to))
   */
  static createdBetween = scope((query, from: DateTime, to: DateTime) => {
    return query.whereBetween('created_at', [from.toISO()!, to.toISO()!])
  })

  /**
   * Filter cases by value range
   * @example Case.query().withScopes((scopes) => scopes.valueBetween(1000, 50000))
   */
  static valueBetween = scope((query, min: number, max: number) => {
    return query.whereBetween('case_value', [min, max])
  })

  /**
   * Order by priority (urgent first)
   * @example Case.query().withScopes((scopes) => scopes.byPriorityOrder())
   */
  static byPriorityOrder = scope((query: Builder) => {
    return query.orderByRaw(`
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
   * @example Case.query().withScopes((scopes) => scopes.newest())
   */
  static newest = scope((query: Builder) => {
    return query.orderBy('created_at', 'desc')
  })

  /**
   * Order by creation date (oldest first)
   * @example Case.query().withScopes((scopes) => scopes.oldest())
   */
  static oldest = scope((query: Builder) => {
    return query.orderBy('created_at', 'asc')
  })

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
