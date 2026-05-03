import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import operationalRecoveryService from '#modules/admin/services/operational_recovery_service'
import { handleOperationalRecovery } from '#modules/admin/jobs/operational_recovery_handler'
import queueService from '#shared/services/queue_service'
import workerHeartbeatService from '#shared/services/worker_heartbeat_service'
import { TenantFactory } from '#database/factories/tenant_factory'
import type { JsonRecord, JobRunStatus } from '#shared/types/model_enums'

type QueuedJob = {
  queueName: string
  jobName: string
  payload: JsonRecord
  options: JsonRecord | undefined
}

test.group('Operational recovery service', () => {
  test('marks stalled runs as failed and enqueues due government sync', async ({ assert }) => {
    const now = DateTime.fromISO('2026-05-03T15:00:00Z')
    const tenant = await TenantFactory.create()
    const runId = await createGovernmentRun(tenant.id, 'running', now.minus({ hours: 8 }))
    const queued = await withOperationalQueueStubs(now, () =>
      operationalRecoveryService.run({
        tenantIds: [tenant.id],
        now,
      })
    )

    assert.equal(queued.result.stalledRunsMarkedFailed, 1)
    assert.equal(queued.result.governmentSyncsEnqueued, 1)
    assert.equal(queued.jobs[0].queueName, 'government-data-sync-orchestrator')
    assert.equal(queued.jobs[0].payload.tenantId, tenant.id)

    const [run] = await db.from('radar_job_runs').where('id', runId).select('*')
    assert.equal(run.status, 'failed')
    assert.equal(run.error_code, 'E_JOB_STALLED')

    await cleanupTenantRuns(tenant.id)
    await tenant.delete()
  })

  test('dry-run reports recovery actions without mutating jobs or queues', async ({ assert }) => {
    const now = DateTime.fromISO('2026-05-03T15:00:00Z')
    const tenant = await TenantFactory.create()
    const runId = await createGovernmentRun(tenant.id, 'running', now.minus({ hours: 8 }))
    const queued = await withOperationalQueueStubs(now, () =>
      operationalRecoveryService.run({
        tenantIds: [tenant.id],
        now,
        dryRun: true,
      })
    )

    assert.equal(queued.result.dryRun, true)
    assert.equal(queued.result.stalledRunsMarkedFailed, 1)
    assert.equal(queued.result.governmentSyncsEnqueued, 0)
    assert.lengthOf(queued.jobs, 0)

    const [run] = await db.from('radar_job_runs').where('id', runId).select('*')
    assert.equal(run.status, 'running')

    await cleanupTenantRuns(tenant.id)
    await tenant.delete()
  })

  test('handler records an auditable global recovery job run', async ({ assert }) => {
    const now = DateTime.fromISO('2026-05-03T15:00:00Z')
    const tenant = await TenantFactory.create()

    const queued = await withOperationalQueueStubs(now, () =>
      handleOperationalRecovery({
        tenantIds: [tenant.id],
        dryRun: true,
        now: now.toISO(),
        origin: 'manual_retry',
      })
    )

    assert.equal(queued.result.dryRun, true)

    const [jobRun] = await db
      .from('radar_job_runs')
      .where('job_name', 'admin-operational-recovery')
      .orderBy('created_at', 'desc')
      .select('*')

    assert.equal(jobRun.status, 'completed')
    assert.equal(jobRun.origin, 'manual_retry')
    assert.isNull(jobRun.tenant_id)
    assert.equal(jobRun.metrics.dryRun, true)

    await cleanupTenantRuns(tenant.id)
    await db.from('radar_job_runs').where('id', jobRun.id).delete()
    await tenant.delete()
  })
})

async function withOperationalQueueStubs<T>(
  now: DateTime,
  callback: () => Promise<T>
): Promise<{ result: T; jobs: QueuedJob[] }> {
  const jobs: QueuedJob[] = []
  const queue = queueService as unknown as {
    add: (
      queueName: string,
      jobName: string,
      payload: JsonRecord,
      options?: JsonRecord
    ) => Promise<{ id: string }>
    getSnapshots: (names: string[]) => Promise<any[]>
  }
  const heartbeats = workerHeartbeatService as unknown as {
    queueFreshness: (names: string[]) => Promise<any[]>
  }
  const originalAdd = queue.add
  const originalGetSnapshots = queue.getSnapshots
  const originalQueueFreshness = heartbeats.queueFreshness

  queue.add = async (queueName, jobName, payload, options) => {
    jobs.push({ queueName, jobName, payload, options })
    return { id: String(options?.jobId ?? 'recovery-job-id') }
  }
  queue.getSnapshots = async (names) =>
    names.map((name) => ({
      name,
      counts: {
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 0,
        failed: 0,
      },
      worker: {
        registered: true,
      },
    }))
  heartbeats.queueFreshness = async (names) =>
    names.map((queueName) => ({
      queueName,
      checkedAt: now.minus({ seconds: 30 }).toJSDate(),
      status: 'ok',
      ageMs: 30_000,
    }))

  try {
    return {
      result: await callback(),
      jobs,
    }
  } finally {
    queue.add = originalAdd
    queue.getSnapshots = originalGetSnapshots
    heartbeats.queueFreshness = originalQueueFreshness
  }
}

async function createGovernmentRun(tenantId: string, status: JobRunStatus, createdAt: DateTime) {
  const [row] = await db
    .table('radar_job_runs')
    .insert({
      tenant_id: tenantId,
      job_name: 'government-data-sync-orchestrator',
      queue_name: 'government-data-sync-orchestrator',
      bullmq_job_id: `recovery-${tenantId}-${status}`,
      status,
      origin: 'scheduler',
      attempts: 1,
      started_at: createdAt.toJSDate(),
      finished_at: status === 'running' ? null : createdAt.plus({ minutes: 1 }).toJSDate(),
      created_at: createdAt.toJSDate(),
      updated_at: createdAt.toJSDate(),
    })
    .returning('*')

  return String(row.id)
}

async function cleanupTenantRuns(tenantId: string) {
  await db.from('radar_job_runs').where('tenant_id', tenantId).delete()
}
