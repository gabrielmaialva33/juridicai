import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import queueService from '#shared/services/queue_service'
import governmentDataSyncScheduleService from '#modules/integrations/services/government_data_sync_schedule_service'
import { GOVERNMENT_DATA_SYNC_ORCHESTRATOR_QUEUE } from '#modules/integrations/jobs/government_data_sync_orchestrator_handler'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export const GOVERNMENT_SYNC_RECENT_SUCCESS_HOURS = 20
export const GOVERNMENT_SYNC_RUNNING_STALE_HOURS = 6
export const GOVERNMENT_SYNC_FAILURE_COOLDOWN_HOURS = 2

type ScheduledGovernmentSyncOptions = {
  now?: DateTime
  tenantIds?: string[]
  recentSuccessHours?: number
  runningStaleHours?: number
  failureCooldownHours?: number
}

type TenantDecision =
  | {
      tenantId: string
      status: 'enqueued'
      jobId: string
      bullmqJobId: string | null
    }
  | {
      tenantId: string
      status: 'skipped'
      reason: 'recent_success' | 'in_progress' | 'recent_failure'
    }
type SkipReason = Extract<TenantDecision, { status: 'skipped' }>['reason']

class ScheduledGovernmentSyncService {
  async enqueueDueRuns(options: ScheduledGovernmentSyncOptions = {}) {
    const now = options.now ?? DateTime.utc()
    const lockKey = lockKeyFor(now)

    return db.transaction(async (trx) => {
      const acquired = await tryAdvisoryTransactionLock(trx, lockKey)

      if (!acquired) {
        return {
          status: 'locked' as const,
          lockKey,
          queuedCount: 0,
          skippedCount: 0,
          tenants: [] as TenantDecision[],
        }
      }

      const tenantIds = options.tenantIds ?? (await activeTenantIds(trx))
      const payload = governmentDataSyncScheduleService.buildScheduledPayload(now)
      const tenants: TenantDecision[] = []

      for (const tenantId of tenantIds) {
        const skipReason = await skipReasonForTenant(trx, tenantId, now, options)

        if (skipReason) {
          tenants.push({
            tenantId,
            status: 'skipped',
            reason: skipReason,
          })
          continue
        }

        const jobId = dailyJobId(tenantId, now)
        const job = await queueService.add(
          GOVERNMENT_DATA_SYNC_ORCHESTRATOR_QUEUE,
          'government-data-sync-orchestrator',
          {
            ...payload,
            tenantId,
            requestId: `government-sync-${tenantId}-${now.toFormat('yyyyLLdd')}`,
            origin: 'scheduler' as const,
          },
          {
            jobId,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
          }
        )

        tenants.push({
          tenantId,
          status: 'enqueued',
          jobId,
          bullmqJobId: job.id ? String(job.id) : null,
        })
      }

      return {
        status: 'completed' as const,
        lockKey,
        queuedCount: tenants.filter((tenant) => tenant.status === 'enqueued').length,
        skippedCount: tenants.filter((tenant) => tenant.status === 'skipped').length,
        tenants,
      }
    })
  }
}

async function activeTenantIds(trx: TransactionClientContract) {
  const rows = await trx.from('tenants').where('status', 'active').select('id').orderBy('id')

  return rows.map((row) => String(row.id))
}

async function skipReasonForTenant(
  trx: TransactionClientContract,
  tenantId: string,
  now: DateTime,
  options: ScheduledGovernmentSyncOptions
): Promise<SkipReason | null> {
  const recentSuccessHours = options.recentSuccessHours ?? GOVERNMENT_SYNC_RECENT_SUCCESS_HOURS
  const runningStaleHours = options.runningStaleHours ?? GOVERNMENT_SYNC_RUNNING_STALE_HOURS
  const failureCooldownHours =
    options.failureCooldownHours ?? GOVERNMENT_SYNC_FAILURE_COOLDOWN_HOURS

  const running = await trx
    .from('radar_job_runs')
    .where('tenant_id', tenantId)
    .where('job_name', 'government-data-sync-orchestrator')
    .where('status', 'running')
    .where('created_at', '>=', now.minus({ hours: runningStaleHours }).toJSDate())
    .first()

  if (running) {
    return 'in_progress'
  }

  const success = await trx
    .from('radar_job_runs')
    .where('tenant_id', tenantId)
    .where('job_name', 'government-data-sync-orchestrator')
    .where('status', 'completed')
    .where('created_at', '>=', now.minus({ hours: recentSuccessHours }).toJSDate())
    .first()

  if (success) {
    return 'recent_success'
  }

  const failure = await trx
    .from('radar_job_runs')
    .where('tenant_id', tenantId)
    .where('job_name', 'government-data-sync-orchestrator')
    .whereIn('status', ['failed', 'skipped', 'cancelled'])
    .where('created_at', '>=', now.minus({ hours: failureCooldownHours }).toJSDate())
    .first()

  if (failure) {
    return 'recent_failure'
  }

  return null
}

async function tryAdvisoryTransactionLock(trx: TransactionClientContract, lockKey: string) {
  const result = await trx.rawQuery(
    `select pg_try_advisory_xact_lock(hashtextextended(?, 0)) as acquired`,
    [lockKey]
  )

  return result.rows[0]?.acquired === true
}

function lockKeyFor(now: DateTime) {
  const windowStart = now.startOf('hour').plus({
    minutes: now.minute >= 30 ? 30 : 0,
  })

  return `juridicai:scheduled-government-data-sync:${windowStart.toFormat('yyyy-LL-dd-HH-mm')}`
}

function dailyJobId(tenantId: string, now: DateTime) {
  return `government-data-sync-orchestrator-${tenantId}-${now.toFormat('yyyy-LL-dd')}`
}

export default new ScheduledGovernmentSyncService()
