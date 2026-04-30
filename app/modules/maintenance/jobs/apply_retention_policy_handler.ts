import db from '@adonisjs/lucid/services/db'
import jobRunService from '#shared/services/job_run_service'

export const APPLY_RETENTION_POLICY_QUEUE = 'maintenance-apply-retention-policy'

const RETENTION_TABLES = {
  client_errors: 'client_errors',
  exports: 'export_jobs',
  source_records: 'source_records',
} as const

type RetentionSubject = keyof typeof RETENTION_TABLES | 'audit_logs' | 'pii_access_logs'

export type ApplyRetentionPolicyPayload = {
  dryRun?: boolean
  bullmqJobId?: string | null
  attempts?: number | null
  origin?: 'scheduler' | 'manual_retry' | 'system'
}

export async function handleApplyRetentionPolicy(payload: ApplyRetentionPolicyPayload = {}) {
  const dryRun = payload.dryRun ?? true
  const run = await jobRunService.start({
    tenantId: null,
    jobName: 'maintenance-apply-retention-policy',
    queueName: APPLY_RETENTION_POLICY_QUEUE,
    bullmqJobId: payload.bullmqJobId ?? null,
    attempts: payload.attempts ?? null,
    origin: payload.origin ?? 'scheduler',
    metadata: { dryRun },
  })

  try {
    const policies = await db
      .from('retention_config')
      .where('enabled', true)
      .orderBy('created_at', 'asc')
    let evaluatedPolicies = 0
    let manifestRows = 0
    let deletedRows = 0

    for (const policy of policies) {
      const subject = policy.subject as RetentionSubject

      if (subject === 'audit_logs' || subject === 'pii_access_logs') {
        continue
      }

      const tableName = RETENTION_TABLES[subject]
      if (!tableName) {
        continue
      }

      const cutoffAt = new Date(Date.now() - Number(policy.retention_days) * 24 * 60 * 60 * 1000)
      const count = await countExpiredRows(tableName, policy.tenant_id, cutoffAt)
      evaluatedPolicies += 1

      if (count === 0) {
        continue
      }

      await db.table('retention_manifest').insert({
        tenant_id: policy.tenant_id,
        subject,
        deleted_count: dryRun ? 0 : count,
        cutoff_at: cutoffAt,
        metadata: {
          dryRun,
          estimatedRows: count,
          tableName,
        },
        created_at: new Date(),
      })
      manifestRows += 1

      if (!dryRun) {
        deletedRows += normalizeMutationCount(
          await deleteExpiredRows(tableName, policy.tenant_id, cutoffAt)
        )
      }
    }

    const metrics = {
      dryRun,
      evaluatedPolicies,
      manifestRows,
      deletedRows,
    }
    await jobRunService.finish(run.id, 'completed', metrics)

    return metrics
  } catch (error) {
    await jobRunService.finish(run.id, 'failed', null, error)
    throw error
  }
}

async function countExpiredRows(tableName: string, tenantId: string | null, cutoffAt: Date) {
  const query = db.from(tableName).where('created_at', '<', cutoffAt)

  if (tenantId) {
    query.where('tenant_id', tenantId)
  }

  const [row] = await query.count('* as total')
  return Number(row.total ?? 0)
}

function deleteExpiredRows(tableName: string, tenantId: string | null, cutoffAt: Date) {
  const query = db.from(tableName).where('created_at', '<', cutoffAt)

  if (tenantId) {
    query.where('tenant_id', tenantId)
  }

  return query.delete()
}

function normalizeMutationCount(value: unknown) {
  return Array.isArray(value) ? value.length : Number(value ?? 0)
}
