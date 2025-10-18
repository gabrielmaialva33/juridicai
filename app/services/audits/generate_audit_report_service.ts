import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import AuditLogsRepository from '#repositories/audit_logs_repository'

interface AuditSummaryStats {
  result: string
  total: number
  unique_users: number
  unique_resources: number
}

interface AuditDailyStats {
  date: string
  total: number
  unique_users: number
}

interface AuditActionStats {
  action: string
  result: string
  total: number
}

interface AuditResourceStats {
  resource: string
  result: string
  total: number
}

interface AuditReportResult {
  summary: AuditSummaryStats[]
  daily: AuditDailyStats[]
  byAction: AuditActionStats[]
  byResource: AuditResourceStats[]
}

@inject()
export default class GenerateAuditReportService {
  constructor(private auditLogsRepository: AuditLogsRepository) {}

  /**
   * Generate a comprehensive audit report for a date range
   * @param start_date - Start date for the report
   * @param end_date - End date for the report
   * @returns Aggregated statistics including summary, daily stats, action stats, and resource stats
   */
  async run(start_date: DateTime, end_date: DateTime): Promise<AuditReportResult> {
    return await this.auditLogsRepository.getStatsByDateRange(start_date, end_date)
  }
}
