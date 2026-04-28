import db from '@adonisjs/lucid/services/db'

type AuditPayload = {
  tenantId?: string | null
  userId?: string | null
  event: string
  entityType?: string | null
  entityId?: string | null
  metadata?: Record<string, unknown> | null
  requestId?: string | null
}

class AuditService {
  write(payload: AuditPayload) {
    return db.table('audit_logs').insert({
      tenant_id: payload.tenantId ?? null,
      user_id: payload.userId ?? null,
      event: payload.event,
      entity_type: payload.entityType ?? null,
      entity_id: payload.entityId ?? null,
      metadata: payload.metadata ?? null,
      request_id: payload.requestId ?? null,
    })
  }
}

export default new AuditService()
