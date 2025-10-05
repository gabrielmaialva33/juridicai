import { inject } from '@adonisjs/core'
import AuditLogsRepository from '#repositories/audit_logs_repository'

@inject()
export default class CleanupOldAuditLogsService {
  constructor(private auditLogsRepository: AuditLogsRepository) {}

  /**
   * Delete audit logs older than the specified number of days
   * @param older_than_days - Delete logs older than this many days
   * @returns Number of deleted records
   */
  async run(older_than_days: number): Promise<number> {
    return await this.auditLogsRepository.cleanupOldLogs(older_than_days)
  }
}
