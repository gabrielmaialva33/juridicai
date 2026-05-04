import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import {
  ASSET_INTELLIGENCE_RECONCILE_QUEUE,
  type AssetIntelligenceReconcilePayload,
} from '#modules/operations/jobs/asset_intelligence_reconcile_handler'
import queueService from '#shared/services/queue_service'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

const RECENT_SUCCESS_HOURS = 4
const RUNNING_STALE_HOURS = 1
const FAILURE_COOLDOWN_HOURS = 1

type ScheduledAssetIntelligenceReconcileOptions = {
  now?: DateTime
  tenantIds?: string[]
  limit?: number | null
  dryRun?: boolean
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

class ScheduledAssetIntelligenceReconcileService {
  async enqueueDueRuns(options: ScheduledAssetIntelligenceReconcileOptions = {}) {
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

        const jobId = scheduledJobId(tenantId, now)
        const payload: AssetIntelligenceReconcilePayload = {
          tenantId,
          limit: options.limit ?? 25,
          dryRun: options.dryRun ?? false,
          highPriorityOnly: false,
          includeManualActions: true,
          allowAutomationWithConflicts: false,
          maxActionsPerAsset: 3,
          recentActionCooldownHours: 6,
          requestId: `asset-intelligence-reconcile-${tenantId}-${now.toFormat('yyyyLLddHH')}`,
          origin: 'scheduler',
        }
        const job = await queueService.add(
          ASSET_INTELLIGENCE_RECONCILE_QUEUE,
          'asset-intelligence-reconcile',
          payload,
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
  options: ScheduledAssetIntelligenceReconcileOptions
): Promise<SkipReason | null> {
  const recentSuccessHours = options.recentSuccessHours ?? RECENT_SUCCESS_HOURS
  const runningStaleHours = options.runningStaleHours ?? RUNNING_STALE_HOURS
  const failureCooldownHours = options.failureCooldownHours ?? FAILURE_COOLDOWN_HOURS

  const running = await trx
    .from('radar_job_runs')
    .where('tenant_id', tenantId)
    .where('job_name', 'asset-intelligence-reconcile')
    .where('status', 'running')
    .where('created_at', '>=', now.minus({ hours: runningStaleHours }).toJSDate())
    .first()

  if (running) {
    return 'in_progress'
  }

  const success = await trx
    .from('radar_job_runs')
    .where('tenant_id', tenantId)
    .where('job_name', 'asset-intelligence-reconcile')
    .where('status', 'completed')
    .where('created_at', '>=', now.minus({ hours: recentSuccessHours }).toJSDate())
    .first()

  if (success) {
    return 'recent_success'
  }

  const failure = await trx
    .from('radar_job_runs')
    .where('tenant_id', tenantId)
    .where('job_name', 'asset-intelligence-reconcile')
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
  const windowStart = now.startOf('hour')

  return `juridicai:scheduled-asset-intelligence-reconcile:${windowStart.toFormat('yyyy-LL-dd-HH')}`
}

function scheduledJobId(tenantId: string, now: DateTime) {
  return `asset-intelligence-reconcile-${tenantId}-${now.toFormat('yyyy-LL-dd-HH')}`
}

export const scheduledAssetIntelligenceReconcileService =
  new ScheduledAssetIntelligenceReconcileService()
export default scheduledAssetIntelligenceReconcileService
