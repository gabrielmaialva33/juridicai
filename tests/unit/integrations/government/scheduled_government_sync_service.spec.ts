import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import scheduledGovernmentSyncService from '#modules/integrations/services/scheduled_government_sync_service'
import queueService from '#shared/services/queue_service'
import { TenantFactory } from '#database/factories/tenant_factory'
import type { JsonRecord } from '#shared/types/model_enums'

type QueuedJob = {
  queueName: string
  jobName: string
  payload: JsonRecord
  options: JsonRecord | undefined
}

test.group('Scheduled government sync service', () => {
  test('enqueues due active tenants with a deterministic daily job id', async ({ assert }) => {
    const tenant = await TenantFactory.merge({ status: 'active' }).create()
    const inactiveTenant = await TenantFactory.merge({ status: 'inactive' }).create()
    const queued = await captureScheduledSync(
      DateTime.fromISO('2026-05-03T12:15:00Z'),
      async (now) =>
        scheduledGovernmentSyncService.enqueueDueRuns({
          now,
        })
    )
    const tenantJob = queued.jobs.find((job) => job.payload.tenantId === tenant.id)

    assert.equal(queued.result.status, 'completed')
    assert.isAtLeast(queued.result.queuedCount, 1)
    assert.exists(tenantJob)
    assert.equal(tenantJob!.queueName, 'government-data-sync-orchestrator')
    assert.equal(tenantJob!.jobName, 'government-data-sync-orchestrator')
    assert.equal(tenantJob!.payload.tenantId, tenant.id)
    assert.equal(tenantJob!.payload.origin, 'scheduler')
    assert.equal(tenantJob!.payload.requestId, `government-sync-${tenant.id}-20260503`)
    assert.equal(
      tenantJob!.options?.jobId,
      `government-data-sync-orchestrator-${tenant.id}-2026-05-03`
    )
    assert.isFalse(queued.jobs.some((job) => job.payload.tenantId === inactiveTenant.id))
    assert.isFalse(
      queued.result.tenants.some(
        (item: { tenantId: string }) => item.tenantId === inactiveTenant.id
      )
    )

    await cleanupTenantRuns([tenant.id, inactiveTenant.id])
    await tenant.delete()
    await inactiveTenant.delete()
  })

  test('skips tenants with recent completed, running, or failed sync runs', async ({ assert }) => {
    const now = DateTime.fromISO('2026-05-03T12:15:00Z')
    const recentSuccessTenant = await TenantFactory.create()
    const runningTenant = await TenantFactory.create()
    const recentFailureTenant = await TenantFactory.create()
    const staleFailureTenant = await TenantFactory.create()
    const tenantIds = [
      recentSuccessTenant.id,
      runningTenant.id,
      recentFailureTenant.id,
      staleFailureTenant.id,
    ]

    await createRun(recentSuccessTenant.id, 'completed', now.minus({ hours: 3 }))
    await createRun(runningTenant.id, 'running', now.minus({ hours: 1 }))
    await createRun(recentFailureTenant.id, 'failed', now.minus({ minutes: 45 }))
    await createRun(staleFailureTenant.id, 'failed', now.minus({ hours: 4 }))

    const queued = await captureScheduledSync(now, (currentNow) =>
      scheduledGovernmentSyncService.enqueueDueRuns({
        now: currentNow,
        tenantIds,
      })
    )

    assert.equal(queued.result.queuedCount, 1)
    assert.equal(queued.result.skippedCount, 3)
    assert.equal(queued.jobs[0].payload.tenantId, staleFailureTenant.id)
    assert.deepInclude(queued.result.tenants, {
      tenantId: recentSuccessTenant.id,
      status: 'skipped',
      reason: 'recent_success',
    })
    assert.deepInclude(queued.result.tenants, {
      tenantId: runningTenant.id,
      status: 'skipped',
      reason: 'in_progress',
    })
    assert.deepInclude(queued.result.tenants, {
      tenantId: recentFailureTenant.id,
      status: 'skipped',
      reason: 'recent_failure',
    })

    await cleanupTenantRuns(tenantIds)
    await recentSuccessTenant.delete()
    await runningTenant.delete()
    await recentFailureTenant.delete()
    await staleFailureTenant.delete()
  })

  test('does not enqueue when another scheduler owns the advisory lock', async ({ assert }) => {
    const now = DateTime.fromISO('2026-05-03T12:15:00Z')
    const tenant = await TenantFactory.create()
    const queued = await captureScheduledSync(now, async (currentNow) =>
      db.transaction(async (trx) => {
        await trx.rawQuery(`select pg_advisory_xact_lock(hashtextextended(?, 0))`, [
          'juridicai:scheduled-government-data-sync:2026-05-03-12-00',
        ])

        return scheduledGovernmentSyncService.enqueueDueRuns({
          now: currentNow,
          tenantIds: [tenant.id],
        })
      })
    )

    assert.equal(queued.result.status, 'locked')
    assert.equal(queued.result.queuedCount, 0)
    assert.lengthOf(queued.jobs, 0)

    await cleanupTenantRuns([tenant.id])
    await tenant.delete()
  })
})

async function captureScheduledSync(
  now: DateTime,
  callback: (now: DateTime) => Promise<Record<string, any>>
) {
  const jobs: QueuedJob[] = []
  const queue = queueService as unknown as {
    add: (
      queueName: string,
      jobName: string,
      payload: JsonRecord,
      options?: JsonRecord
    ) => Promise<{ id: string }>
  }
  const originalAdd = queue.add

  queue.add = async (queueName, jobName, payload, options) => {
    jobs.push({ queueName, jobName, payload, options })
    return { id: String(options?.jobId ?? 'scheduled-job-id') }
  }

  try {
    const result = await callback(now)

    return {
      result,
      jobs,
    }
  } finally {
    queue.add = originalAdd
  }
}

async function createRun(
  tenantId: string,
  status: 'completed' | 'failed' | 'running',
  createdAt: DateTime
) {
  await db.table('radar_job_runs').insert({
    tenant_id: tenantId,
    job_name: 'government-data-sync-orchestrator',
    queue_name: 'government-data-sync-orchestrator',
    bullmq_job_id: `test-${tenantId}-${status}`,
    status,
    origin: 'scheduler',
    attempts: 1,
    started_at: createdAt.toJSDate(),
    finished_at: status === 'running' ? null : createdAt.plus({ minutes: 1 }).toJSDate(),
    created_at: createdAt.toJSDate(),
    updated_at: createdAt.toJSDate(),
  })
}

async function cleanupTenantRuns(tenantIds: string[]) {
  await db
    .from('radar_job_runs')
    .whereIn('tenant_id', tenantIds)
    .where('job_name', 'government-data-sync-orchestrator')
    .delete()
}
