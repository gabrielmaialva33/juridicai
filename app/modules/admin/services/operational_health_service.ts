import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import queueService from '#shared/services/queue_service'
import workerHeartbeatService from '#shared/services/worker_heartbeat_service'
import { operationalQueueNames } from '#shared/constants/operational_queues'
import {
  GOVERNMENT_SYNC_FAILURE_COOLDOWN_HOURS,
  GOVERNMENT_SYNC_RECENT_SUCCESS_HOURS,
  GOVERNMENT_SYNC_RUNNING_STALE_HOURS,
} from '#modules/integrations/services/scheduled_government_sync_service'
import {
  ASSET_INTELLIGENCE_RECONCILE_FAILURE_COOLDOWN_HOURS,
  ASSET_INTELLIGENCE_RECONCILE_RECENT_SUCCESS_HOURS,
  ASSET_INTELLIGENCE_RECONCILE_RUNNING_STALE_HOURS,
} from '#modules/operations/services/scheduled_asset_intelligence_reconcile_service'

const QUEUE_BACKLOG_WARNING_THRESHOLD = 100
const STALLED_RUN_LIMIT = 25

type QueueSnapshot = Awaited<ReturnType<typeof queueService.getQueueSnapshot>>
type WorkerFreshness = Awaited<ReturnType<typeof workerHeartbeatService.queueFreshness>>[number]

class OperationalHealthService {
  async build(tenantId: string, now: DateTime = DateTime.utc()) {
    const [queueSnapshots, workers, stalledRuns, governmentSync, assetIntelligenceReconcile] =
      await Promise.all([
        queueService.getSnapshots([...operationalQueueNames]),
        workerHeartbeatService.queueFreshness([...operationalQueueNames]),
        this.stalledRuns(tenantId, now),
        this.governmentSyncState(tenantId, now),
        this.assetIntelligenceReconcileState(tenantId, now),
      ])
    const queues = queueSnapshots.map((snapshot) => queueHealth(snapshot))
    const workerItems = workers.map((worker) => workerHealth(worker))
    const status = overallStatus({
      queues,
      workers: workerItems,
      stalledRunsCount: stalledRuns.length,
      governmentSyncStatus: governmentSync.status,
      assetIntelligenceReconcileStatus: assetIntelligenceReconcile.status,
    })

    return {
      generatedAt: now.toISO(),
      status,
      queues: {
        total: queues.length,
        degraded: queues.filter((queue) => queue.status === 'degraded').length,
        backlogged: queues.filter((queue) => queue.status === 'backlogged').length,
        items: queues,
      },
      workers: {
        total: workerItems.length,
        stale: workerItems.filter((worker) => worker.status === 'stale').length,
        items: workerItems,
      },
      stalledRuns: {
        total: stalledRuns.length,
        staleAfterHours: GOVERNMENT_SYNC_RUNNING_STALE_HOURS,
        items: stalledRuns,
      },
      governmentSync,
      assetIntelligenceReconcile,
    }
  }

  private async stalledRuns(tenantId: string, now: DateTime) {
    const rows = await db
      .from('radar_job_runs')
      .where('tenant_id', tenantId)
      .where('status', 'running')
      .where(
        'created_at',
        '<',
        now.minus({ hours: GOVERNMENT_SYNC_RUNNING_STALE_HOURS }).toJSDate()
      )
      .orderBy('created_at', 'asc')
      .limit(STALLED_RUN_LIMIT)

    return rows.map((row) => ({
      id: String(row.id),
      jobName: String(row.job_name),
      queueName: row.queue_name ? String(row.queue_name) : null,
      bullmqJobId: row.bullmq_job_id ? String(row.bullmq_job_id) : null,
      attempts: Number(row.attempts ?? 0),
      createdAt: dateIso(row.created_at),
      startedAt: dateIso(row.started_at),
      ageMs: dateAgeMs(row.created_at, now),
    }))
  }

  private async governmentSyncState(tenantId: string, now: DateTime) {
    return scheduledJobState({
      tenantId,
      jobName: 'government-data-sync-orchestrator',
      now,
      windows: {
        recentSuccessHours: GOVERNMENT_SYNC_RECENT_SUCCESS_HOURS,
        runningStaleHours: GOVERNMENT_SYNC_RUNNING_STALE_HOURS,
        failureCooldownHours: GOVERNMENT_SYNC_FAILURE_COOLDOWN_HOURS,
      },
    })
  }

  private async assetIntelligenceReconcileState(tenantId: string, now: DateTime) {
    return scheduledJobState({
      tenantId,
      jobName: 'asset-intelligence-reconcile',
      now,
      windows: {
        recentSuccessHours: ASSET_INTELLIGENCE_RECONCILE_RECENT_SUCCESS_HOURS,
        runningStaleHours: ASSET_INTELLIGENCE_RECONCILE_RUNNING_STALE_HOURS,
        failureCooldownHours: ASSET_INTELLIGENCE_RECONCILE_FAILURE_COOLDOWN_HOURS,
      },
    })
  }
}

async function scheduledJobState(input: {
  tenantId: string
  jobName: string
  now: DateTime
  windows: {
    recentSuccessHours: number
    runningStaleHours: number
    failureCooldownHours: number
  }
}) {
  const [running, completed, failed, latest] = await Promise.all([
    latestTenantJobRun(input.tenantId, input.jobName, ['running']),
    latestTenantJobRun(input.tenantId, input.jobName, ['completed']),
    latestTenantJobRun(input.tenantId, input.jobName, ['failed', 'skipped', 'cancelled']),
    latestTenantJobRun(input.tenantId, input.jobName, [
      'pending',
      'running',
      'completed',
      'failed',
      'skipped',
      'cancelled',
    ]),
  ])
  const runningAgeMs = running ? dateAgeMs(running.created_at, input.now) : null
  const completedAgeMs = completed ? dateAgeMs(completed.created_at, input.now) : null
  const failedAgeMs = failed ? dateAgeMs(failed.created_at, input.now) : null

  if (
    running &&
    runningAgeMs !== null &&
    runningAgeMs <= hoursToMs(input.windows.runningStaleHours)
  ) {
    return scheduledJobPayload({
      tenantId: input.tenantId,
      jobName: input.jobName,
      status: 'in_progress',
      reason: 'recent_running_run',
      now: input.now,
      windows: input.windows,
      latest,
      running,
      completed,
      failed,
    })
  }

  if (
    completed &&
    completedAgeMs !== null &&
    completedAgeMs <= hoursToMs(input.windows.recentSuccessHours)
  ) {
    return scheduledJobPayload({
      tenantId: input.tenantId,
      jobName: input.jobName,
      status: 'healthy',
      reason: 'recent_success',
      now: input.now,
      windows: input.windows,
      latest,
      running,
      completed,
      failed,
    })
  }

  if (
    failed &&
    failedAgeMs !== null &&
    failedAgeMs <= hoursToMs(input.windows.failureCooldownHours)
  ) {
    return scheduledJobPayload({
      tenantId: input.tenantId,
      jobName: input.jobName,
      status: 'cooldown',
      reason: 'recent_failure',
      now: input.now,
      windows: input.windows,
      latest,
      running,
      completed,
      failed,
    })
  }

  return scheduledJobPayload({
    tenantId: input.tenantId,
    jobName: input.jobName,
    status: 'due',
    reason: latest ? 'outside_due_window' : 'never_ran',
    now: input.now,
    windows: input.windows,
    latest,
    running,
    completed,
    failed,
  })
}

function queueHealth(snapshot: QueueSnapshot) {
  const waiting = Number(snapshot.counts.waiting ?? 0)
  const delayed = Number(snapshot.counts.delayed ?? 0)
  const active = Number(snapshot.counts.active ?? 0)
  const failed = Number(snapshot.counts.failed ?? 0)
  const backlog = waiting + delayed
  const status =
    failed > 0
      ? 'degraded'
      : backlog >= QUEUE_BACKLOG_WARNING_THRESHOLD
        ? 'backlogged'
        : ('ok' as const)

  return {
    name: snapshot.name,
    status,
    counts: {
      waiting,
      active,
      delayed,
      completed: Number(snapshot.counts.completed ?? 0),
      failed,
    },
    backlog,
    workerRegistered: snapshot.worker.registered,
  }
}

function workerHealth(worker: WorkerFreshness) {
  return {
    queueName: worker.queueName,
    status: worker.status,
    checkedAt: dateIso(worker.checkedAt),
    ageMs: worker.ageMs,
  }
}

async function latestTenantJobRun(tenantId: string, jobName: string, statuses: string[]) {
  return db
    .from('radar_job_runs')
    .where('tenant_id', tenantId)
    .where('job_name', jobName)
    .whereIn('status', statuses)
    .orderBy('created_at', 'desc')
    .first()
}

function scheduledJobPayload(input: {
  tenantId: string
  jobName: string
  status: 'healthy' | 'in_progress' | 'cooldown' | 'due'
  reason: string
  now: DateTime
  windows: {
    recentSuccessHours: number
    runningStaleHours: number
    failureCooldownHours: number
  }
  latest: Record<string, any> | null
  running: Record<string, any> | null
  completed: Record<string, any> | null
  failed: Record<string, any> | null
}) {
  return {
    tenantId: input.tenantId,
    jobName: input.jobName,
    status: input.status,
    reason: input.reason,
    windows: input.windows,
    latestRun: serializeRun(input.latest, input.now),
    runningRun: serializeRun(input.running, input.now),
    lastCompletedRun: serializeRun(input.completed, input.now),
    lastFailedRun: serializeRun(input.failed, input.now),
  }
}

function serializeRun(row: Record<string, any> | null, now: DateTime) {
  if (!row) {
    return null
  }

  return {
    id: String(row.id),
    status: String(row.status),
    origin: String(row.origin),
    queueName: row.queue_name ? String(row.queue_name) : null,
    bullmqJobId: row.bullmq_job_id ? String(row.bullmq_job_id) : null,
    attempts: Number(row.attempts ?? 0),
    createdAt: dateIso(row.created_at),
    startedAt: dateIso(row.started_at),
    finishedAt: dateIso(row.finished_at),
    ageMs: dateAgeMs(row.created_at, now),
    errorCode: row.error_code ? String(row.error_code) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
  }
}

function overallStatus(input: {
  queues: Array<{ status: string }>
  workers: Array<{ status: string }>
  stalledRunsCount: number
  governmentSyncStatus: string
  assetIntelligenceReconcileStatus: string
}) {
  if (
    input.queues.some((queue) => queue.status === 'degraded') ||
    input.workers.some((worker) => worker.status === 'stale') ||
    input.stalledRunsCount > 0
  ) {
    return 'degraded' as const
  }

  if (
    input.queues.some((queue) => queue.status === 'backlogged') ||
    ['cooldown', 'due'].includes(input.governmentSyncStatus) ||
    ['cooldown', 'due'].includes(input.assetIntelligenceReconcileStatus)
  ) {
    return 'attention' as const
  }

  return 'ok' as const
}

function dateIso(value: unknown) {
  if (!value) {
    return null
  }

  return new Date(value as string | number | Date).toISOString()
}

function dateAgeMs(value: unknown, now: DateTime) {
  if (!value) {
    return null
  }

  return now.toMillis() - new Date(value as string | number | Date).getTime()
}

function hoursToMs(hours: number) {
  return hours * 60 * 60 * 1000
}

export default new OperationalHealthService()
