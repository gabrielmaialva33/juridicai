import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import operationalHealthService from '#modules/admin/services/operational_health_service'
import queueService from '#shared/services/queue_service'
import workerHeartbeatService from '#shared/services/worker_heartbeat_service'
import { TenantFactory } from '#database/factories/tenant_factory'
import type { JobRunStatus } from '#shared/types/model_enums'

test.group('Operational health service', () => {
  test('reports healthy queues, workers, and recent government sync', async ({ assert }) => {
    const now = DateTime.fromISO('2026-05-03T15:00:00Z')
    const tenant = await TenantFactory.create()

    await createGovernmentRun(tenant.id, 'completed', now.minus({ hours: 1 }))

    const result = await withOperationalStubs(
      {
        queues: [queueSnapshot('government-data-sync-orchestrator')],
        workers: [
          workerSnapshot('government-data-sync-orchestrator', 'ok', now.minus({ seconds: 20 })),
        ],
      },
      () => operationalHealthService.build(tenant.id, now)
    )

    assert.equal(result.status, 'ok')
    assert.equal(result.queues.total, 1)
    assert.equal(result.workers.stale, 0)
    assert.equal(result.stalledRuns.total, 0)
    assert.equal(result.governmentSync.status, 'healthy')
    assert.equal(result.governmentSync.reason, 'recent_success')
    assert.equal(result.governmentSync.lastCompletedRun?.status, 'completed')

    await cleanupTenantRuns(tenant.id)
    await tenant.delete()
  })

  test('marks operational health as attention during government sync failure cooldown', async ({
    assert,
  }) => {
    const now = DateTime.fromISO('2026-05-03T15:00:00Z')
    const tenant = await TenantFactory.create()

    await createGovernmentRun(tenant.id, 'failed', now.minus({ minutes: 30 }), {
      errorCode: 'DataJudUnavailable',
      errorMessage: 'DataJud public API returned 503',
    })

    const result = await withOperationalStubs(
      {
        queues: [queueSnapshot('government-data-sync-orchestrator')],
        workers: [
          workerSnapshot('government-data-sync-orchestrator', 'ok', now.minus({ seconds: 20 })),
        ],
      },
      () => operationalHealthService.build(tenant.id, now)
    )

    assert.equal(result.status, 'attention')
    assert.equal(result.governmentSync.status, 'cooldown')
    assert.equal(result.governmentSync.reason, 'recent_failure')
    assert.equal(result.governmentSync.lastFailedRun?.errorCode, 'DataJudUnavailable')

    await cleanupTenantRuns(tenant.id)
    await tenant.delete()
  })

  test('marks operational health as degraded for failed queues, stale workers, and stalled runs', async ({
    assert,
  }) => {
    const now = DateTime.fromISO('2026-05-03T15:00:00Z')
    const tenant = await TenantFactory.create()

    await createGovernmentRun(tenant.id, 'running', now.minus({ hours: 8 }))

    const result = await withOperationalStubs(
      {
        queues: [
          queueSnapshot('government-data-sync-orchestrator', {
            failed: 2,
            waiting: 5,
          }),
        ],
        workers: [
          workerSnapshot('government-data-sync-orchestrator', 'stale', now.minus({ minutes: 5 })),
        ],
      },
      () => operationalHealthService.build(tenant.id, now)
    )

    assert.equal(result.status, 'degraded')
    assert.equal(result.queues.degraded, 1)
    assert.equal(result.workers.stale, 1)
    assert.equal(result.stalledRuns.total, 1)
    assert.equal(result.stalledRuns.items[0].jobName, 'government-data-sync-orchestrator')
    assert.equal(result.governmentSync.status, 'due')

    await cleanupTenantRuns(tenant.id)
    await tenant.delete()
  })
})

async function withOperationalStubs<T>(
  stubs: {
    queues: Array<ReturnType<typeof queueSnapshot>>
    workers: Array<ReturnType<typeof workerSnapshot>>
  },
  callback: () => Promise<T>
) {
  const queue = queueService as unknown as {
    getSnapshots: (names: string[]) => Promise<Array<ReturnType<typeof queueSnapshot>>>
  }
  const heartbeats = workerHeartbeatService as unknown as {
    queueFreshness: (names: string[]) => Promise<Array<ReturnType<typeof workerSnapshot>>>
  }
  const originalGetSnapshots = queue.getSnapshots
  const originalQueueFreshness = heartbeats.queueFreshness

  queue.getSnapshots = async () => stubs.queues
  heartbeats.queueFreshness = async () => stubs.workers

  try {
    return await callback()
  } finally {
    queue.getSnapshots = originalGetSnapshots
    heartbeats.queueFreshness = originalQueueFreshness
  }
}

function queueSnapshot(
  name: string,
  counts: Partial<Record<'waiting' | 'active' | 'delayed' | 'completed' | 'failed', number>> = {}
) {
  return {
    name,
    counts: {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      delayed: counts.delayed ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
    },
    worker: {
      registered: true,
    },
  }
}

function workerSnapshot(queueName: string, status: 'ok' | 'stale', checkedAt: DateTime) {
  return {
    queueName,
    checkedAt: checkedAt.toJSDate(),
    status,
    ageMs: DateTime.utc().toMillis() - checkedAt.toMillis(),
  }
}

async function createGovernmentRun(
  tenantId: string,
  status: JobRunStatus,
  createdAt: DateTime,
  error: { errorCode?: string; errorMessage?: string } = {}
) {
  await db.table('radar_job_runs').insert({
    tenant_id: tenantId,
    job_name: 'government-data-sync-orchestrator',
    queue_name: 'government-data-sync-orchestrator',
    bullmq_job_id: `health-${tenantId}-${status}`,
    status,
    origin: 'scheduler',
    attempts: 1,
    error_code: error.errorCode ?? null,
    error_message: error.errorMessage ?? null,
    started_at: createdAt.toJSDate(),
    finished_at: status === 'running' ? null : createdAt.plus({ minutes: 1 }).toJSDate(),
    created_at: createdAt.toJSDate(),
    updated_at: createdAt.toJSDate(),
  })
}

async function cleanupTenantRuns(tenantId: string) {
  await db
    .from('radar_job_runs')
    .where('tenant_id', tenantId)
    .where('job_name', 'government-data-sync-orchestrator')
    .delete()
}
