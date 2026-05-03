import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import betaReadinessService from '#modules/admin/services/beta_readiness_service'
import queueService from '#shared/services/queue_service'
import workerHeartbeatService from '#shared/services/worker_heartbeat_service'

test.group('Beta readiness service', () => {
  test('reports bootstrap, integration, operations, data and coverage readiness', async ({
    assert,
  }) => {
    const queued = await withOperationalStubs(() =>
      betaReadinessService.build({
        now: DateTime.fromISO('2026-05-03T18:00:00Z'),
      })
    )

    assert.equal(queued.status, 'warn')
    assert.equal(queued.tenant?.slug, 'juridicai-local')
    assert.includeMembers(
      queued.sections.map((section) => section.key),
      ['bootstrap', 'integration_config', 'data_evidence', 'operations', 'coverage']
    )

    const bootstrap = queued.sections.find((section) => section.key === 'bootstrap')
    const operations = queued.sections.find((section) => section.key === 'operations')
    const dataEvidence = queued.sections.find((section) => section.key === 'data_evidence')

    assert.equal(bootstrap?.status, 'pass')
    assert.equal(operations?.status, 'warn')
    assert.isAtLeast(dataEvidence?.checks.length ?? 0, 10)
    assert.isTrue(queued.nextActions.some((action) => action.section === 'data_evidence'))
  })

  test('fails clearly when the requested tenant is missing', async ({ assert }) => {
    const report = await withOperationalStubs(() =>
      betaReadinessService.build({
        tenantId: '00000000-0000-0000-0000-000000000000',
        now: DateTime.fromISO('2026-05-03T18:00:00Z'),
      })
    )

    assert.equal(report.status, 'fail')
    assert.isNull(report.tenant)
    assert.isTrue(
      report.sections
        .find((section) => section.key === 'bootstrap')
        ?.checks.some((check) => check.key === 'tenant.active' && check.status === 'fail')
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
    names.map((queueName, index) => ({
      queueName,
      checkedAt: index === 0 ? null : DateTime.utc().minus({ seconds: 30 }).toJSDate(),
      status: index === 0 ? 'stale' : 'ok',
      ageMs: index === 0 ? null : 30_000,
    }))

  try {
    return await callback()
  } finally {
    queue.getSnapshots = originalGetSnapshots
    heartbeats.queueFreshness = originalQueueFreshness
  }
}
