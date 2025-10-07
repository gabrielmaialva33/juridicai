import { inject } from '@adonisjs/core'
import AuditLog from '#models/audit_log'
import IAuditLog from '#interfaces/audit_log_interface'
import LucidRepository from '#shared/lucid/lucid_repository'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'

@inject()
export default class AuditLogsRepository
  extends LucidRepository<typeof AuditLog>
  implements IAuditLog.Repository
{
  constructor() {
    super(AuditLog)
  }

  /**
   * Get audit logs for a specific user
   * @param userId - The user ID to filter by
   * @param limit - Maximum number of logs to return (default: 100)
   * @returns Array of audit logs ordered by most recent first
   */
  async getUserLogs(userId: number, limit: number = 100): Promise<AuditLog[]> {
    return this.model.query().where('user_id', userId).orderBy('created_at', 'desc').limit(limit)
  }

  /**
   * Get security alerts based on failed logins and permission denials
   * @param days - Number of days to look back for security events (default: 7)
   * @returns Array of denied access logs from the specified period
   */
  async getSecurityAlerts(days: number = 7): Promise<AuditLog[]> {
    const cutoffDate = DateTime.now().minus({ days })

    return this.model
      .query()
      .where('result', 'denied')
      .where('created_at', '>=', cutoffDate.toISO())
      .orderBy('created_at', 'desc')
  }

  /**
   * Get statistics aggregated by date range
   * @param startDate - Start date for the range
   * @param endDate - End date for the range
   * @returns Aggregated statistics including total logs, granted/denied counts, unique users, and resources
   */
  async getStatsByDateRange(startDate: DateTime, endDate: DateTime): Promise<any> {
    const stats = await db
      .from('audit_logs')
      .whereBetween('created_at', [startDate.toISO()!, endDate.toISO()!])
      .select('result')
      .count('* as total')
      .countDistinct('user_id as unique_users')
      .countDistinct('resource as unique_resources')
      .groupBy('result')

    const dailyStats = await db
      .from('audit_logs')
      .whereBetween('created_at', [startDate.toISO()!, endDate.toISO()!])
      .select(db.raw('DATE(created_at) as date'))
      .count('* as total')
      .countDistinct('user_id as unique_users')
      .groupByRaw('DATE(created_at)')
      .orderByRaw('DATE(created_at) asc')

    const actionStats = await db
      .from('audit_logs')
      .whereBetween('created_at', [startDate.toISO()!, endDate.toISO()!])
      .select('action', 'result')
      .count('* as total')
      .groupBy('action', 'result')
      .orderBy('total', 'desc')

    const resourceStats = await db
      .from('audit_logs')
      .whereBetween('created_at', [startDate.toISO()!, endDate.toISO()!])
      .select('resource', 'result')
      .count('* as total')
      .groupBy('resource', 'result')
      .orderBy('total', 'desc')

    return {
      summary: stats,
      daily: dailyStats,
      byAction: actionStats,
      byResource: resourceStats,
    }
  }

  /**
   * Delete old audit logs
   * @param olderThanDays - Delete logs older than this many days
   * @returns Number of deleted records
   */
  async cleanupOldLogs(olderThanDays: number): Promise<number> {
    const cutoffDate = DateTime.now().minus({ days: olderThanDays })

    const result = await this.model.query().where('created_at', '<', cutoffDate.toISO()).delete()

    return Array.isArray(result) ? result[0] : result
  }

  /**
   * Find audit logs by action type
   * @param action - The action to filter by
   * @param limit - Maximum number of logs to return (default: 100)
   * @returns Array of audit logs matching the action
   */
  async findByAction(action: string, limit: number = 100): Promise<AuditLog[]> {
    return this.model.query().where('action', action).orderBy('created_at', 'desc').limit(limit)
  }

  /**
   * Find audit logs by resource type
   * @param resource - The resource to filter by
   * @param limit - Maximum number of logs to return (default: 100)
   * @returns Array of audit logs matching the resource
   */
  async findByResource(resource: string, limit: number = 100): Promise<AuditLog[]> {
    return this.model.query().where('resource', resource).orderBy('created_at', 'desc').limit(limit)
  }

  /**
   * Find audit logs by result (granted/denied)
   * @param result - The result to filter by
   * @param limit - Maximum number of logs to return (default: 100)
   * @returns Array of audit logs matching the result
   */
  async findByResult(result: 'granted' | 'denied', limit: number = 100): Promise<AuditLog[]> {
    return this.model.query().where('result', result).orderBy('created_at', 'desc').limit(limit)
  }

  /**
   * Find audit logs by IP address
   * @param ipAddress - The IP address to filter by
   * @param limit - Maximum number of logs to return (default: 100)
   * @returns Array of audit logs from the specified IP address
   */
  async findByIpAddress(ipAddress: string, limit: number = 100): Promise<AuditLog[]> {
    return this.model
      .query()
      .where('ip_address', ipAddress)
      .orderBy('created_at', 'desc')
      .limit(limit)
  }

  /**
   * Search audit logs with pagination
   * @param filters - Filter criteria including user_id, resource, action, result, date range, etc.
   * @param page - Page number (1-based)
   * @param limit - Number of results per page
   * @returns Paginated results of matching audit logs
   */
  async searchLogs(
    filters: IAuditLog.FilterPayload,
    page: number,
    limit: number
  ): Promise<ModelPaginatorContract<AuditLog>> {
    const query = this.model.query()

    if (filters.user_id) {
      query.where('user_id', filters.user_id)
    }

    if (filters.session_id) {
      query.where('session_id', filters.session_id)
    }

    if (filters.ip_address) {
      query.where('ip_address', filters.ip_address)
    }

    if (filters.resource) {
      query.where('resource', filters.resource)
    }

    if (filters.action) {
      query.where('action', filters.action)
    }

    if (filters.context) {
      query.where('context', filters.context)
    }

    if (filters.resource_id) {
      query.where('resource_id', filters.resource_id)
    }

    if (filters.result) {
      query.where('result', filters.result)
    }

    if (filters.method) {
      query.where('method', filters.method)
    }

    if (filters.start_date && filters.end_date) {
      query.whereBetween('created_at', [filters.start_date.toISO()!, filters.end_date.toISO()!])
    } else if (filters.start_date) {
      query.where('created_at', '>=', filters.start_date.toISO()!)
    } else if (filters.end_date) {
      query.where('created_at', '<=', filters.end_date.toISO()!)
    }

    return query.orderBy('created_at', 'desc').paginate(page, limit)
  }
}
