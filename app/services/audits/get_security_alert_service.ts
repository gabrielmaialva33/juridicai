import { inject } from '@adonisjs/core'
import AuditLog from '#models/audit_log'
import AuditLogsRepository from '#repositories/audit_logs_repository'

@inject()
export default class GetSecurityAlertsService {
  constructor(private auditLogsRepository: AuditLogsRepository) {}

  /**
   * Get security alerts based on failed permission checks and denied access
   * @param days - Number of days to look back for security events (default: 7)
   * @returns Array of denied access logs from the specified period
   */
  async run(days: number = 7): Promise<AuditLog[]> {
    return await this.auditLogsRepository.getSecurityAlerts(days)
  }
}
