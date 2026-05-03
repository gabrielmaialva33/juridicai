import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import {
  type BetaIngestionDrillOptions,
  BetaIngestionDrillService,
} from '#modules/admin/services/beta_ingestion_drill_service'
import queueService from '#shared/services/queue_service'
import workerHeartbeatService from '#shared/services/worker_heartbeat_service'
import type { GovernmentDataSyncOrchestratorPayload } from '#modules/integrations/jobs/government_data_sync_orchestrator_handler'

test.group('Beta ingestion drill service', () => {
  test('runs a conservative dry-run drill and records readiness deltas', async ({ assert }) => {
    const now = DateTime.fromISO('2026-05-03T18:00:00Z')
    const capturedPayloads: GovernmentDataSyncOrchestratorPayload[] = []
    const service = new BetaIngestionDrillService(async (payload) => {
      capturedPayloads.push(payload)

      return {
        dryRun: payload.dryRun,
        phases: {
          siopOpenData: {
            years: payload.years,
          },
        },
      }
    })

    const report = await withOperationalStubs(() =>
      service.run({
        now,
        dryRun: true,
      } satisfies BetaIngestionDrillOptions)
    )

    assert.equal(report.dryRun, true)
    assert.notEqual(report.readiness.before.status, 'fail')
    assert.notEqual(report.readiness.after.status, 'fail')
    assert.lengthOf(capturedPayloads, 1)
    assert.equal(capturedPayloads[0].dryRun, true)
    assert.deepEqual(capturedPayloads[0].years, [2026])
    assert.lengthOf(capturedPayloads[0].dataJudCourtAliases ?? [], 12)
    assert.deepEqual(capturedPayloads[0].djenCourtAliases, capturedPayloads[0].dataJudCourtAliases)
    assert.equal(capturedPayloads[0].dataJudPageSize, 25)
    assert.equal(capturedPayloads[0].dataJudMaxPagesPerCourt, 1)
    assert.equal(capturedPayloads[0].djenStartDate, '2026-04-26')
    assert.equal(capturedPayloads[0].djenEndDate, '2026-05-03')
    assert.equal(capturedPayloads[0].tjspLimit, 2)
    assert.equal(capturedPayloads[0].fetchTimeoutMs, 20_000)
    assert.properties(report.deltas, [
      'source_records',
      'precatorio_assets',
      'judicial_processes',
      'publications',
    ])

    const [jobRun] = await db
      .from('radar_job_runs')
      .where('job_name', 'beta-ingestion-drill')
      .orderBy('created_at', 'desc')
      .select('*')

    assert.equal(jobRun.status, 'completed')
    assert.equal(jobRun.metrics.dryRun, true)

    await db.from('radar_job_runs').where('id', jobRun.id).delete()
  })

  test('fails before ingestion when the tenant is missing', async ({ assert }) => {
    const service = new BetaIngestionDrillService(async () => {
      throw new Error('Pipeline should not run')
    })

    await assert.rejects(
      () =>
        service.run({
          tenantId: '00000000-0000-0000-0000-000000000000',
          dryRun: true,
        }),
      /Tenant 00000000-0000-0000-0000-000000000000 was not found/
    )
  })
})

async function withOperationalStubs<T>(callback: () => Promise<T>) {
  const queue = queueService as unknown as {
    getSnapshots: (names: string[]) => Promise<any[]>
  }
  const heartbeats = workerHeartbeatService as unknown as {
    queueFreshness: (names: string[]) => Promise<any[]>
  }
  const originalGetSnapshots = queue.getSnapshots
  const originalQueueFreshness = heartbeats.queueFreshness

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
      checkedAt: DateTime.utc().minus({ seconds: 30 }).toJSDate(),
      status: 'ok',
      ageMs: 30_000,
    }))

  try {
    return await callback()
  } finally {
    queue.getSnapshots = originalGetSnapshots
    heartbeats.queueFreshness = originalQueueFreshness
  }
}
