import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import type { TenantStatus } from '#shared/types/model_enums'
import TenantMembership from '#modules/tenant/models/tenant_membership'
import UserRole from '#modules/permission/models/user_role'

export default class Tenant extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare document: string | null

  @column()
  declare status: TenantStatus

  @column()
  declare plan: string | null

  @column()
  declare rbacVersion: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => TenantMembership)
  declare memberships: HasMany<typeof TenantMembership>

  @hasMany(() => UserRole)
  declare userRoles: HasMany<typeof UserRole>
}
