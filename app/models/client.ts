import { DateTime } from 'luxon'
import { column, hasMany, scope } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import TenantAwareModel from '#models/tenant_aware_model'
import Case from '#models/case'

type ClientType = 'individual' | 'company'

interface ClientAddress {
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
}

export default class Client extends TenantAwareModel {
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
  declare client_type: ClientType

  @column()
  declare full_name: string | null

  @column()
  declare cpf: string | null

  @column()
  declare company_name: string | null

  @column()
  declare cnpj: string | null

  @column()
  declare email: string | null

  @column()
  declare phone: string | null

  @column({
    prepare: (value: ClientAddress | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | null) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare address: ClientAddress | null

  @column({
    prepare: (value: string[] | null) => (value ? `{${value.join(',')}}` : null),
    consume: (value: string | string[] | null) => {
      if (!value) return null
      // PostgreSQL returns arrays as JavaScript arrays directly
      if (Array.isArray(value)) return value
      // But in some cases it might be a string: {tag1,tag2,tag3}
      return value.replace(/[{}]/g, '').split(',').filter(Boolean)
    },
  })
  declare tags: string[] | null

  @column()
  declare is_active: boolean

  @column({
    prepare: (value: Record<string, any> | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | null) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare custom_fields: Record<string, any> | null

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  /**
   * ------------------------------------------------------
   * Relationships
   * ------------------------------------------------------
   */
  @hasMany(() => Case, {
    foreignKey: 'client_id',
  })
  declare cases: HasMany<typeof Case>

  /**
   * ------------------------------------------------------
   * Helpers
   * ------------------------------------------------------
   */
  get display_name(): string {
    return this.client_type === 'individual'
      ? this.full_name || 'No name'
      : this.company_name || 'No company name'
  }

  get tax_id(): string | null {
    return this.client_type === 'individual' ? this.cpf : this.cnpj
  }

  /**
   * ------------------------------------------------------
   * Query Scopes
   * ------------------------------------------------------
   */

  /**
   * Search clients by name, CPF, CNPJ, email
   * @example Client.query().withScopes(s => s.search('john'))
   */
  static search = scope((query, term: string) => {
    if (!term || !term.trim()) return

    const searchTerm = `%${term.trim()}%`
    const cleanTerm = term.replace(/\D/g, '') // Remove non-digits for CPF/CNPJ search

    query.where((builder) => {
      builder
        .whereILike('full_name', searchTerm)
        .orWhereILike('company_name', searchTerm)
        .orWhereILike('email', searchTerm)

      // Search for CPF/CNPJ if term has numbers
      if (cleanTerm) {
        builder.orWhere('cpf', cleanTerm).orWhere('cnpj', cleanTerm)
      }
    })
  })

  /**
   * Filter clients by type (individual or company)
   * @example Client.query().withScopes(s => s.ofType('individual'))
   */
  static ofType = scope((query, type: ClientType) => {
    query.where('client_type', type)
  })

  /**
   * Filter active clients
   * @example Client.query().withScopes(s => s.active())
   */
  static active = scope((query) => {
    query.where('is_active', true)
  })

  /**
   * Filter inactive clients
   * @example Client.query().withScopes(s => s.inactive())
   */
  static inactive = scope((query) => {
    query.where('is_active', false)
  })

  /**
   * Filter clients with active cases
   * @example Client.query().withScopes(s => s.withActiveCases())
   */
  static withActiveCases = scope((query) => {
    query.whereHas('cases', (caseQuery) => {
      caseQuery.whereIn('status', ['active', 'in_progress'])
    })
  })

  /**
   * Filter clients without cases
   * @example Client.query().withScopes(s => s.withoutCases())
   */
  static withoutCases = scope((query) => {
    query.doesntHave('cases')
  })

  /**
   * Include cases relationship
   * @example Client.query().withScopes(s => s.withCases())
   */
  static withCases = scope((query) => {
    query.preload('cases', (casesQuery) => {
      casesQuery.orderBy('created_at', 'desc')
    })
  })

  /**
   * Include cases count
   * @example Client.query().withScopes(s => s.withCasesCount())
   */
  static withCasesCount = scope((query) => {
    query.withCount('cases', (q) => {
      q.as('cases_count')
    })
  })

  /**
   * Filter by state
   * @example Client.query().withScopes(s => s.byState('SP'))
   */
  static byState = scope((query, state: string) => {
    query.whereRaw("address->>'state' = ?", [state])
  })

  /**
   * Filter by city
   * @example Client.query().withScopes(s => s.byCity('São Paulo'))
   */
  static byCity = scope((query, city: string) => {
    query.whereRaw("address->>'city' = ?", [city])
  })

  /**
   * Filter clients with tags
   * @example Client.query().withScopes(s => s.hasTag('vip'))
   */
  static hasTag = scope((query, tag: string) => {
    query.whereRaw('? = ANY(tags)', [tag])
  })

  /**
   * Filter clients with any of the tags
   * @example Client.query().withScopes(s => s.hasAnyTag(['vip', 'priority']))
   */
  static hasAnyTag = scope((query, tags: string[]) => {
    query.whereRaw('tags && ?', [`{${tags.join(',')}}`])
  })

  /**
   * Filter clients created between dates
   * @example Client.query().withScopes(s => s.createdBetween(from, to))
   */
  static createdBetween = scope((query, from: DateTime, to: DateTime) => {
    query.whereBetween('created_at', [from.toSQL(), to.toSQL()])
  })

  /**
   * Filter clients created after date
   * @example Client.query().withScopes(s => s.createdAfter(date))
   */
  static createdAfter = scope((query, date: DateTime) => {
    query.where('created_at', '>', date.toSQL())
  })

  /**
   * Filter clients created before date
   * @example Client.query().withScopes(s => s.createdBefore(date))
   */
  static createdBefore = scope((query, date: DateTime) => {
    query.where('created_at', '<', date.toSQL())
  })

  /**
   * Filter clients created recently
   * @example Client.query().withScopes(s => s.recent(7))
   */
  static recent = scope((query, days = 7) => {
    const date = DateTime.now().minus({ days })
    query.where('created_at', '>=', date.toSQL())
  })

  /**
   * Order by name (considering both individual and company)
   * @example Client.query().withScopes(s => s.alphabetical())
   */
  static alphabetical = scope((query) => {
    query.orderByRaw(`
      CASE
        WHEN client_type = 'individual' THEN COALESCE(full_name, '')
        ELSE COALESCE(company_name, '')
      END ASC
    `)
  })

  /**
   * Order by creation date (newest first)
   * @example Client.query().withScopes(s => s.newest())
   */
  static newest = scope((query) => {
    query.orderBy('created_at', 'desc')
  })

  /**
   * Order by creation date (oldest first)
   * @example Client.query().withScopes(s => s.oldest())
   */
  static oldest = scope((query) => {
    query.orderBy('created_at', 'asc')
  })
}
