import { DateTime } from 'luxon'
import { column, hasMany } from '@adonisjs/lucid/orm'
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
}
