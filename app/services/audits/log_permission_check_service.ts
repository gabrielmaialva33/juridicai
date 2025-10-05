import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import AuditLog from '#models/audit_log'
import AuditLogsRepository from '#repositories/audit_logs_repository'

interface PermissionCheckData {
  user_id?: number
  session_id?: string
  resource: string
  action: string
  context?: string
  resource_id?: number
  result: 'granted' | 'denied'
  reason?: string
  metadata?: Record<string, any>
}

@inject()
export default class LogPermissionCheckService {
  constructor(private auditLogsRepository: AuditLogsRepository) {}

  /**
   * Log a permission check result with optional HTTP context
   * @param data - The permission check data to log
   * @param ctx - Optional HTTP context to capture request information
   * @returns The created audit log entry
   */
  async run(data: PermissionCheckData, ctx?: HttpContext): Promise<AuditLog> {
    const auditData: Partial<AuditLog> = {
      user_id: data.user_id || null,
      session_id: data.session_id || null,
      resource: data.resource,
      action: data.action,
      context: data.context || null,
      resource_id: data.resource_id || null,
      result: data.result,
      reason: data.reason || null,
      metadata: data.metadata || null,
    }

    // Add request context if available
    if (ctx) {
      auditData.ip_address = ctx.request.ip()
      auditData.user_agent = ctx.request.header('User-Agent') || null
      auditData.method = ctx.request.method()
      auditData.url = ctx.request.url()
      auditData.response_code = ctx.response.getStatus()

      // Capture relevant request data (excluding sensitive info)
      auditData.request_data = this.sanitizeRequestData(ctx.request.all())
    }

    return await this.auditLogsRepository.create(auditData)
  }

  /**
   * Sanitize request data to remove sensitive information
   * @param data - The raw request data
   * @returns Sanitized data with sensitive fields redacted
   */
  private sanitizeRequestData(data: Record<string, any>): Record<string, any> {
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization', 'cookie']
    const sanitized: Record<string, any> = {}

    Object.keys(data).forEach((key) => {
      const lowerKey = key.toLowerCase()
      const isSensitive = sensitiveFields.some((field) => lowerKey.includes(field))

      if (isSensitive) {
        sanitized[key] = '[REDACTED]'
      } else {
        sanitized[key] = data[key]
      }
    })

    return sanitized
  }
}
