import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import TenantUser from '#models/tenant_user'

type TenantPlan = 'free' | 'starter' | 'pro' | 'enterprise'

interface TenantLimits {
  max_users?: number
  max_cases?: number
  max_storage_gb?: number
  max_documents?: number

  [key: string]: any
}

export default class Tenant extends BaseModel {
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare subdomain: string

  @column()
  declare custom_domain: string | null

  @column()
  declare plan: TenantPlan

  @column()
  declare is_active: boolean

  @column({
    prepare: (value: TenantLimits | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | null) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare limits: TenantLimits | null

  @column.dateTime()
  declare trial_ends_at: DateTime | null

  @column.dateTime()
  declare suspended_at: DateTime | null

  @column()
  declare suspended_reason: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // Relationships
  @hasMany(() => TenantUser, {
    foreignKey: 'tenant_id',
  })
  declare tenant_users: HasMany<typeof TenantUser>
}
