import { inject } from '@adonisjs/core'
import AuditLog from '#models/audit_log'
import AuditLogsRepository from '#repositories/audit_logs_repository'

@inject()
export default class GetUserAuditLogsService {
  constructor(private auditLogsRepository: AuditLogsRepository) {}

  /**
   * Get audit logs for a specific user
   * @param user_id - The ID of the user
   * @param limit - Maximum number of logs to return (default: 100)
   * @returns Array of audit logs ordered by most recent first
   */
  async run(user_id: number, limit: number = 100): Promise<AuditLog[]> {
    return await this.auditLogsRepository.getUserLogs(user_id, limit)
  }
}
