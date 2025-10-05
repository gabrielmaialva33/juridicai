import LucidRepositoryInterface from '#shared/lucid/lucid_repository_interface'
import AuditLog from '#models/audit_log'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import { DateTime } from 'luxon'

namespace IAuditLog {
  export interface Repository extends LucidRepositoryInterface<typeof AuditLog> {
    /**
     * Get audit logs for a specific user
     * @param userId - The user ID to filter by
     * @param limit - Maximum number of logs to return
     */
    getUserLogs(userId: number, limit?: number): Promise<AuditLog[]>

    /**
     * Get security alerts based on failed logins and permission denials
     * @param days - Number of days to look back for security events (default: 7)
     */
    getSecurityAlerts(days?: number): Promise<AuditLog[]>

    /**
     * Get statistics aggregated by date range
     * @param startDate - Start date for the range
     * @param endDate - End date for the range
     */
    getStatsByDateRange(startDate: DateTime, endDate: DateTime): Promise<any>

    /**
     * Delete old audit logs
     * @param olderThanDays - Delete logs older than this many days
     * @returns Number of deleted records
     */
    cleanupOldLogs(olderThanDays: number): Promise<number>

    /**
     * Find audit logs by action type
     * @param action - The action to filter by
     * @param limit - Maximum number of logs to return
     */
    findByAction(action: string, limit?: number): Promise<AuditLog[]>

    /**
     * Find audit logs by resource type
     * @param resource - The resource to filter by
     * @param limit - Maximum number of logs to return
     */
    findByResource(resource: string, limit?: number): Promise<AuditLog[]>

    /**
     * Find audit logs by result (granted/denied)
     * @param result - The result to filter by
     * @param limit - Maximum number of logs to return
     */
    findByResult(result: 'granted' | 'denied', limit?: number): Promise<AuditLog[]>

    /**
     * Find audit logs by IP address
     * @param ipAddress - The IP address to filter by
     * @param limit - Maximum number of logs to return
     */
    findByIpAddress(ipAddress: string, limit?: number): Promise<AuditLog[]>

    /**
     * Search audit logs with pagination
     * @param filters - Filter criteria
     * @param page - Page number
     * @param limit - Results per page
     */
    searchLogs(
      filters: FilterPayload,
      page: number,
      limit: number
    ): Promise<ModelPaginatorContract<AuditLog>>
  }

  export interface CreatePayload {
    user_id?: number | null
    session_id?: string | null
    ip_address?: string | null
    user_agent?: string | null
    resource: string
    action: string
    context?: string | null
    resource_id?: number | null
    method?: string | null
    url?: string | null
    request_data?: Record<string, any> | null
    result: 'granted' | 'denied'
    reason?: string | null
    response_code?: number | null
    metadata?: Record<string, any> | null
  }

  export interface EditPayload {
    user_id?: number | null
    session_id?: string | null
    ip_address?: string | null
    user_agent?: string | null
    resource?: string
    action?: string
    context?: string | null
    resource_id?: number | null
    method?: string | null
    url?: string | null
    request_data?: Record<string, any> | null
    result?: 'granted' | 'denied'
    reason?: string | null
    response_code?: number | null
    metadata?: Record<string, any> | null
  }

  export interface FilterPayload {
    user_id?: number
    session_id?: string
    ip_address?: string
    resource?: string
    action?: string
    context?: string
    resource_id?: number
    result?: 'granted' | 'denied'
    method?: string
    start_date?: DateTime
    end_date?: DateTime
  }
}

export default IAuditLog
