import { inject } from '@adonisjs/core'
import AuditLog from '#models/audit_log'
import AuditLogsRepository from '#repositories/audit_logs_repository'

interface UserActionData {
  user_id: number
  action: string
  resource: string
  resource_id?: number
  ip_address?: string
  user_agent?: string
  metadata?: Record<string, any>
  status?: 'granted' | 'denied'
}

@inject()
export default class LogUserActionService {
  constructor(private auditLogsRepository: AuditLogsRepository) {}

  /**
   * Log a user action to the audit trail
   * @param data - The user action data to log
   * @returns The created audit log entry
   */
  async run(data: UserActionData): Promise<AuditLog> {
    const auditData: Partial<AuditLog> = {
      user_id: data.user_id,
      action: data.action,
      resource: data.resource,
      resource_id: data.resource_id || null,
      ip_address: data.ip_address || null,
      user_agent: data.user_agent || null,
      metadata: data.metadata || null,
      result: data.status || 'granted',
    }

    return await this.auditLogsRepository.create(auditData)
  }
}
