import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import operationalHealthService from '#modules/admin/services/operational_health_service'
import scheduledGovernmentSyncService, {
  GOVERNMENT_SYNC_RUNNING_STALE_HOURS,
} from '#modules/integrations/services/scheduled_government_sync_service'

type OperationalRecoveryOptions = {
  tenantIds?: string[] | null
  dryRun?: boolean
  now?: DateTime
}

type TenantRecoveryAction = {
  tenantId: string
  healthStatus: 'ok' | 'attention' | 'degraded'
  governmentSyncStatus: string
  stalledRunsMarkedFailed: number
  stalledCoverageRunsMarkedFailed: number
  governmentSyncEnqueued: boolean
  governmentSyncSkippedReason: string | null
}

class OperationalRecoveryService {
  async run(options: OperationalRecoveryOptions = {}) {
    const now = options.now ?? DateTime.utc()
    const dryRun = options.dryRun ?? false
    const tenantIds = options.tenantIds?.length ? options.tenantIds : await activeTenantIds()
    const tenants: TenantRecoveryAction[] = []

    for (const tenantId of tenantIds) {
      const health = await operationalHealthService.build(tenantId, now)
      const stalledRunsMarkedFailed = await this.recoverStalledRuns(tenantId, now, dryRun)
      const stalledCoverageRunsMarkedFailed = await this.recoverStalledCoverageRuns(
        tenantId,
        now,
        dryRun
      )
      const governmentSync = await this.recoverGovernmentSync(tenantId, health, now, dryRun)

      tenants.push({
        tenantId,
        healthStatus: health.status,
        governmentSyncStatus: health.governmentSync.status,
        stalledRunsMarkedFailed,
        stalledCoverageRunsMarkedFailed,
        governmentSyncEnqueued: governmentSync.enqueued,
        governmentSyncSkippedReason: governmentSync.skippedReason,
      })
    }

    return {
      dryRun,
      generatedAt: now.toISO(),
      tenantsEvaluated: tenants.length,
      stalledRunsMarkedFailed: tenants.reduce(
        (total, tenant) => total + tenant.stalledRunsMarkedFailed,
        0
      ),
      stalledCoverageRunsMarkedFailed: tenants.reduce(
        (total, tenant) => total + tenant.stalledCoverageRunsMarkedFailed,
        0
      ),
      governmentSyncsEnqueued: tenants.filter((tenant) => tenant.governmentSyncEnqueued).length,
      tenants,
    }
  }

  private async recoverStalledRuns(tenantId: string, now: DateTime, dryRun: boolean) {
    const staleBefore = now.minus({ hours: GOVERNMENT_SYNC_RUNNING_STALE_HOURS }).toJSDate()
    const rows = await db
      .from('radar_job_runs')
      .where('tenant_id', tenantId)
      .where('status', 'running')
      .where('created_at', '<', staleBefore)
      .select('id')

    if (dryRun || rows.length === 0) {
      return rows.length
    }

    await db
      .from('radar_job_runs')
      .whereIn(
        'id',
        rows.map((row) => String(row.id))
      )
      .update({
        status: 'failed',
        error_code: 'E_JOB_STALLED',
        error_message: `Marked failed by operational recovery after ${GOVERNMENT_SYNC_RUNNING_STALE_HOURS} stale running hours.`,
        finished_at: now.toJSDate(),
        duration_ms: db.raw('extract(epoch from (?::timestamptz - started_at)) * 1000', [
          now.toISO(),
        ]),
        updated_at: now.toJSDate(),
      })

    return rows.length
  }

  private async recoverStalledCoverageRuns(tenantId: string, now: DateTime, dryRun: boolean) {
    const staleBefore = now.minus({ hours: GOVERNMENT_SYNC_RUNNING_STALE_HOURS }).toJSDate()
    const rows = await db
      .from('coverage_runs')
      .where('tenant_id', tenantId)
      .where('status', 'running')
      .where('started_at', '<', staleBefore)
      .select('id')

    if (dryRun || rows.length === 0) {
      return rows.length
    }

    await db
      .from('coverage_runs')
      .whereIn(
        'id',
        rows.map((row) => String(row.id))
      )
      .update({
        status: 'failed',
        error_count: db.raw('greatest(error_count, 1)'),
        error_message: `Marked failed by operational recovery after ${GOVERNMENT_SYNC_RUNNING_STALE_HOURS} stale running hours.`,
        finished_at: now.toJSDate(),
        updated_at: now.toJSDate(),
      })

    return rows.length
  }

  private async recoverGovernmentSync(
    tenantId: string,
    health: Awaited<ReturnType<typeof operationalHealthService.build>>,
    now: DateTime,
    dryRun: boolean
  ) {
    if (health.governmentSync.status !== 'due') {
      return {
        enqueued: false,
        skippedReason: health.governmentSync.status,
      }
    }

    if (dryRun) {
      return {
        enqueued: false,
        skippedReason: 'dry_run',
      }
    }

    const result = await scheduledGovernmentSyncService.enqueueDueRuns({
      now,
      tenantIds: [tenantId],
      failureCooldownHours: 0,
    })
    const tenant = result.tenants.find((item) => item.tenantId === tenantId)

    return {
      enqueued: tenant?.status === 'enqueued',
      skippedReason:
        tenant?.status === 'skipped'
          ? tenant.reason
          : result.status === 'locked'
            ? 'scheduler_locked'
            : null,
    }
  }
}

async function activeTenantIds() {
  const rows = await db.from('tenants').where('status', 'active').select('id').orderBy('id')

  return rows.map((row) => String(row.id))
}

export default new OperationalRecoveryService()
