import { DateTime } from 'luxon'
import {
  BaseModel,
  column,
  computed,
  hasMany,
  scope,
  SnakeCaseNamingStrategy,
} from '@adonisjs/lucid/orm'
import { compose } from '@adonisjs/core/helpers'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

import { withTenantScope } from '#mixins/with_tenant_scope'
import Case from '#models/case'

type Builder = ModelQueryBuilderContract<typeof Client>

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

// Create the tenant-scoped mixin
const TenantScoped = withTenantScope()

export default class Client extends compose(BaseModel, TenantScoped) {
  static table = 'clients'
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
    consume: (value: string | Record<string, any> | null) => {
      if (!value) return null
      if (typeof value === 'string') return JSON.parse(value)
      return value
    },
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
    consume: (value: string | null) => (value ? JSON.parse(value) : null),
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
   * Hooks
   * ------------------------------------------------------
   */

  /**
   * ------------------------------------------------------
   * Query Scopes
   * ------------------------------------------------------
   */

  /**
   * Search clients by name, CPF, CNPJ, email
   * @example Client.query().withScopes((scopes) => scopes.search('john'))
   */
  static search = scope((query, term: string) => {
    if (!term || !term.trim()) return query

    const searchTerm = `%${term.trim()}%`
    const cleanTerm = term.replace(/\D/g, '')

    return query.where((builder) => {
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
   * @example Client.query().withScopes((scopes) => scopes.ofType('individual'))
   */
  static ofType = scope((query, type: ClientType) => {
    return query.where('client_type', type)
  })

  /**
   * Filter active clients
   * @example Client.query().withScopes((scopes) => scopes.active())
   */
  static active = scope((query: Builder) => {
    return query.where('is_active', true)
  })

  /**
   * Filter inactive clients
   * @example Client.query().withScopes((scopes) => scopes.inactive())
   */
  static inactive = scope((query: Builder) => {
    return query.where('is_active', false)
  })

  /**
   * Filter clients with active cases
   * @example Client.query().withScopes((scopes) => scopes.withActiveCases())
   */
  static withActiveCases = scope((query: Builder) => {
    return query.whereHas('cases', (caseQuery) => {
      caseQuery.whereIn('status', ['active', 'in_progress'])
    })
  })

  /**
   * Filter clients without cases
   * @example Client.query().withScopes((scopes) => scopes.withoutCases())
   */
  static withoutCases = scope((query: Builder) => {
    return query.doesntHave('cases')
  })

  /**
   * Include cases relationship
   * @example Client.query().withScopes((scopes) => scopes.withCases())
   */
  static withCases = scope((query: Builder) => {
    return query.preload('cases', (casesQuery) => {
      casesQuery.orderBy('created_at', 'desc')
    })
  })

  /**
   * Include cases count
   * @example Client.query().withScopes((scopes) => scopes.withCasesCount())
   */
  static withCasesCount = scope((query: Builder) => {
    return query.withCount('cases', (q) => {
      q.as('cases_count')
    })
  })

  /**
   * Filter by state
   * @example Client.query().withScopes((scopes) => scopes.byState('SP'))
   */
  static byState = scope((query, state: string) => {
    return query.whereRaw("address->>'state' = ?", [state])
  })

  /**
   * Filter by city
   * @example Client.query().withScopes((scopes) => scopes.byCity('São Paulo'))
   */
  static byCity = scope((query, city: string) => {
    return query.whereRaw("address->>'city' = ?", [city])
  })

  /**
   * Filter clients with tags
   * @example Client.query().withScopes((scopes) => scopes.hasTag('vip'))
   */
  static hasTag = scope((query, tag: string) => {
    return query.whereRaw('? = ANY(tags)', [tag])
  })

  /**
   * Filter clients with any of the tags
   * @example Client.query().withScopes((scopes) => scopes.hasAnyTag(['vip', 'priority']))
   */
  static hasAnyTag = scope((query, tags: string[]) => {
    return query.whereRaw('tags && ?', [`{${tags.join(',')}}`])
  })

  /**
   * Filter clients created between dates
   * @example Client.query().withScopes((scopes) => scopes.createdBetween(from, to))
   */
  static createdBetween = scope((query, from: DateTime, to: DateTime) => {
    return query.whereBetween('created_at', [from.toISO()!, to.toISO()!])
  })

  /**
   * Filter clients created after date
   * @example Client.query().withScopes((scopes) => scopes.createdAfter(date))
   */
  static createdAfter = scope((query, date: DateTime) => {
    return query.where('created_at', '>', date.toISO()!)
  })

  /**
   * Filter clients created before date
   * @example Client.query().withScopes((scopes) => scopes.createdBefore(date))
   */
  static createdBefore = scope((query, date: DateTime) => {
    return query.where('created_at', '<', date.toISO()!)
  })

  /**
   * Filter clients created recently
   * @example Client.query().withScopes((scopes) => scopes.recent(7))
   */
  static recent = scope((query: Builder, days = 7) => {
    const date = DateTime.now().minus({ days })
    return query.where('created_at', '>=', date.toISO())
  })

  /**
   * Order by name (considering both individual and company)
   * @example Client.query().withScopes((scopes) => scopes.alphabetical())
   */
  static alphabetical = scope((query: Builder) => {
    return query.orderByRaw(`
      CASE
        WHEN client_type = 'individual' THEN COALESCE(full_name, '')
        ELSE COALESCE(company_name, '')
      END ASC
    `)
  })

  /**
   * Order by creation date (newest first)
   * @example Client.query().withScopes((scopes) => scopes.newest())
   */
  static newest = scope((query: Builder) => {
    return query.orderBy('created_at', 'desc')
  })

  /**
   * Order by creation date (oldest first)
   * @example Client.query().withScopes((scopes) => scopes.oldest())
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
   * Returns the display name based on client type
   * For individual clients, returns full_name; for companies, returns company_name
   */
  @computed()
  get display_name(): string {
    return this.client_type === 'individual'
      ? this.full_name || 'No name'
      : this.company_name || 'No company name'
  }

  /**
   * Returns the tax ID based on client type
   * For individual clients, returns CPF; for companies, returns CNPJ
   */
  @computed()
  get tax_id(): string | null {
    return this.client_type === 'individual' ? this.cpf : this.cnpj
  }
}
