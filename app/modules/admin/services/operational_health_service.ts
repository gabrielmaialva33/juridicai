import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import queueService from '#shared/services/queue_service'
import workerHeartbeatService from '#shared/services/worker_heartbeat_service'
import { queueNames } from '#start/jobs'
import {
  GOVERNMENT_SYNC_FAILURE_COOLDOWN_HOURS,
  GOVERNMENT_SYNC_RECENT_SUCCESS_HOURS,
  GOVERNMENT_SYNC_RUNNING_STALE_HOURS,
} from '#modules/integrations/services/scheduled_government_sync_service'

const QUEUE_BACKLOG_WARNING_THRESHOLD = 100
const STALLED_RUN_LIMIT = 25

type QueueSnapshot = Awaited<ReturnType<typeof queueService.getQueueSnapshot>>
type WorkerFreshness = Awaited<ReturnType<typeof workerHeartbeatService.queueFreshness>>[number]

class OperationalHealthService {
  async build(tenantId: string, now: DateTime = DateTime.utc()) {
    const [queueSnapshots, workers, stalledRuns, governmentSync] = await Promise.all([
      queueService.getSnapshots(queueNames),
      workerHeartbeatService.queueFreshness(queueNames),
      this.stalledRuns(tenantId, now),
      this.governmentSyncState(tenantId, now),
    ])
    const queues = queueSnapshots.map((snapshot) => queueHealth(snapshot))
    const workerItems = workers.map((worker) => workerHealth(worker))
    const status = overallStatus({
      queues,
      workers: workerItems,
      stalledRunsCount: stalledRuns.length,
      governmentSyncStatus: governmentSync.status,
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
    const [running, completed, failed, latest] = await Promise.all([
      latestGovernmentSyncRun(tenantId, ['running']),
      latestGovernmentSyncRun(tenantId, ['completed']),
      latestGovernmentSyncRun(tenantId, ['failed', 'skipped', 'cancelled']),
      latestGovernmentSyncRun(tenantId, [
        'pending',
        'running',
        'completed',
        'failed',
        'skipped',
        'cancelled',
      ]),
    ])
    const runningAgeMs = running ? dateAgeMs(running.created_at, now) : null
    const completedAgeMs = completed ? dateAgeMs(completed.created_at, now) : null
    const failedAgeMs = failed ? dateAgeMs(failed.created_at, now) : null

    if (
      running &&
      runningAgeMs !== null &&
      runningAgeMs <= hoursToMs(GOVERNMENT_SYNC_RUNNING_STALE_HOURS)
    ) {
      return governmentSyncPayload({
        tenantId,
        status: 'in_progress',
        reason: 'recent_running_run',
        now,
        latest,
        running,
        completed,
        failed,
      })
    }

    if (
      completed &&
      completedAgeMs !== null &&
      completedAgeMs <= hoursToMs(GOVERNMENT_SYNC_RECENT_SUCCESS_HOURS)
    ) {
      return governmentSyncPayload({
        tenantId,
        status: 'healthy',
        reason: 'recent_success',
        now,
        latest,
        running,
        completed,
        failed,
      })
    }

    if (
      failed &&
      failedAgeMs !== null &&
      failedAgeMs <= hoursToMs(GOVERNMENT_SYNC_FAILURE_COOLDOWN_HOURS)
    ) {
      return governmentSyncPayload({
        tenantId,
        status: 'cooldown',
        reason: 'recent_failure',
        now,
        latest,
        running,
        completed,
        failed,
      })
    }

    return governmentSyncPayload({
      tenantId,
      status: 'due',
      reason: latest ? 'outside_due_window' : 'never_ran',
      now,
      latest,
      running,
      completed,
      failed,
    })
  }
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

async function latestGovernmentSyncRun(tenantId: string, statuses: string[]) {
  return db
    .from('radar_job_runs')
    .where('tenant_id', tenantId)
    .where('job_name', 'government-data-sync-orchestrator')
    .whereIn('status', statuses)
    .orderBy('created_at', 'desc')
    .first()
}

function governmentSyncPayload(input: {
  tenantId: string
  status: 'healthy' | 'in_progress' | 'cooldown' | 'due'
  reason: string
  now: DateTime
  latest: Record<string, any> | null
  running: Record<string, any> | null
  completed: Record<string, any> | null
  failed: Record<string, any> | null
}) {
  return {
    tenantId: input.tenantId,
    status: input.status,
    reason: input.reason,
    windows: {
      recentSuccessHours: GOVERNMENT_SYNC_RECENT_SUCCESS_HOURS,
      runningStaleHours: GOVERNMENT_SYNC_RUNNING_STALE_HOURS,
      failureCooldownHours: GOVERNMENT_SYNC_FAILURE_COOLDOWN_HOURS,
    },
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
    ['cooldown', 'due'].includes(input.governmentSyncStatus)
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
