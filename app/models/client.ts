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
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: string

  @column()
  declare client_type: ClientType

  // Individual (pessoa física)
  @column()
  declare full_name: string | null

  @column()
  declare cpf: string | null

  // Company (pessoa jurídica)
  @column()
  declare company_name: string | null

  @column()
  declare cnpj: string | null

  // Common fields
  @column()
  declare email: string | null

  @column()
  declare phone: string | null

  @column({
    prepare: (value: ClientAddress | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | null) => (value ? JSON.parse(value) : null),
  })
  declare address: ClientAddress | null

  @column({
    prepare: (value: string[] | null) => (value ? `{${value.join(',')}}` : null),
    consume: (value: string | null) => {
      if (!value) return null
      // PostgreSQL array format: {tag1,tag2,tag3}
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

  // Relationships (will be added later)
  @hasMany(() => Case)
  declare cases: HasMany<typeof Case>

  /**
   * Helper: Get display name (individual or company)
   */
  get display_name(): string {
    return this.client_type === 'individual'
      ? this.full_name || 'Sem nome'
      : this.company_name || 'Sem razão social'
  }

  /**
   * Helper: Get tax ID (CPF or CNPJ)
   */
  get tax_id(): string | null {
    return this.client_type === 'individual' ? this.cpf : this.cnpj
  }
}
