import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, scope, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import { compose } from '@adonisjs/core/helpers'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import { withTenantScope } from '#mixins/with_tenant_scope'
import User from '#models/user'

const TenantScoped = withTenantScope()

export default class AuditLog extends compose(BaseModel, TenantScoped) {
  static table = 'audit_logs'
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
  declare user_id: number | null

  @column()
  declare session_id: string | null

  @column()
  declare ip_address: string | null

  @column()
  declare user_agent: string | null

  @column()
  declare resource: string

  @column()
  declare action: string

  @column()
  declare context: string | null

  @column()
  declare resource_id: number | null

  @column()
  declare method: string | null

  @column()
  declare url: string | null

  @column()
  declare request_data: Record<string, any> | null

  @column()
  declare result: 'granted' | 'denied'

  @column()
  declare reason: string | null

  @column()
  declare response_code: number | null

  @column()
  declare metadata: Record<string, any> | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime | null

  /**
   * ------------------------------------------------------
   * Relationships
   * ------------------------------------------------------
   */
  @belongsTo(() => User, { foreignKey: 'user_id' })
  declare user: BelongsTo<typeof User>

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
   * Filter audit logs by user
   * @example AuditLog.query().withScopes((scopes) => scopes.byUser(userId))
   */
  static byUser = scope((query, userId: number) => {
    return query.where('user_id', userId)
  })

  /**
   * Filter audit logs by resource
   * @example AuditLog.query().withScopes((scopes) => scopes.byResource('users'))
   */
  static byResource = scope((query, resource: string) => {
    return query.where('resource', resource)
  })

  /**
   * Filter audit logs by action
   * @example AuditLog.query().withScopes((scopes) => scopes.byAction('create'))
   */
  static byAction = scope((query, action: string) => {
    return query.where('action', action)
  })

  /**
   * Filter audit logs by result
   * @example AuditLog.query().withScopes((scopes) => scopes.byResult('granted'))
   */
  static byResult = scope((query, result: 'granted' | 'denied') => {
    return query.where('result', result)
  })

  /**
   * Filter audit logs between dates
   * @example AuditLog.query().withScopes((scopes) => scopes.byDateRange(startDate, endDate))
   */
  static byDateRange = scope((query, startDate: DateTime, endDate: DateTime) => {
    return query.whereBetween('created_at', [startDate.toSQL()!, endDate.toSQL()!])
  })

  /**
   * Filter audit logs by IP address
   * @example AuditLog.query().withScopes((scopes) => scopes.byIpAddress('192.168.1.1'))
   */
  static byIpAddress = scope((query, ipAddress: string) => {
    return query.where('ip_address', ipAddress)
  })

  /**
   * Order audit logs by creation date (newest first)
   * @example AuditLog.query().withScopes((scopes) => scopes.recentFirst())
   */
  static recentFirst = scope((query) => {
    return query.orderBy('created_at', 'desc')
  })
}
