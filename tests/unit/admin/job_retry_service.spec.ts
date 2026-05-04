import { test } from '@japa/runner'
import jobRetryService from '#modules/admin/services/job_retry_service'
import queueService from '#shared/services/queue_service'
import type RadarJobRun from '#modules/admin/models/radar_job_run'
import type { JsonRecord } from '#shared/types/model_enums'

type QueuedJob = {
  queueName: string
  jobName: string
  payload: JsonRecord
  options: JsonRecord | undefined
}

test.group('Job retry service', () => {
  test('retries government data sync from stored run metadata', async ({ assert }) => {
    const queued = await captureRetry(
      runFor('government-data-sync-orchestrator', {
        requestId: 'old-request',
        years: [2026, 2027],
        dataJudCourtAliases: ['trf1', 'tjsp'],
        dataJudPageSize: 50,
        dataJudMaxPagesPerCourt: 2,
        djenCourtAliases: ['tjsp'],
        djenSearchTexts: ['precatório'],
        tjspCategories: ['state_entities'],
        tjspLimit: 10,
        tjspImportDocuments: false,
        enrichLimit: 25,
        linkLimit: 50,
        signalLimit: 75,
        publicationLimit: 80,
        matchLimit: 90,
        candidatesPerAsset: 4,
        source: 'tribunal',
        dryRun: true,
      }),
      'new-request'
    )

    assert.equal(queued.queueName, 'government-data-sync-orchestrator')
    assert.equal(queued.jobName, 'government-data-sync-orchestrator')
    assert.include(queued.payload, {
      tenantId: 'tenant-1',
      requestId: 'new-request',
      dataJudPageSize: 50,
      dataJudMaxPagesPerCourt: 2,
      tjspLimit: 10,
      tjspImportDocuments: false,
      origin: 'manual_retry',
      dryRun: true,
    })
    assert.deepEqual(queued.payload.years, [2026, 2027])
    assert.deepEqual(queued.payload.dataJudCourtAliases, ['trf1', 'tjsp'])
    assert.deepEqual(queued.payload.djenCourtAliases, ['tjsp'])
    assert.deepEqual(queued.payload.tjspCategories, ['state_entities'])
  })

  test('retries tribunal source sync with bounded adapter options', async ({ assert }) => {
    const queued = await captureRetry(
      runFor('tribunal-source-sync', {
        targetKeys: ['target-a', 'target-b'],
        adapterKeys: ['trf3_precatorio_sync'],
        statuses: ['implemented'],
        limit: 2,
        genericTribunalDownloadLinkedDocuments: false,
        tjmaYears: [2026],
        tjmaKinds: ['chronological_list'],
        trf3Years: [2026],
        trf3Months: [1, 2],
        trf3Formats: ['csv', 'xlsx'],
        trf5Kinds: ['federal_debt'],
        postImportCreateOpportunities: false,
      })
    )

    assert.equal(queued.queueName, 'tribunal-source-sync')
    assert.include(queued.payload, {
      tenantId: 'tenant-1',
      limit: 2,
      genericTribunalDownloadLinkedDocuments: false,
      postImportCreateOpportunities: false,
      dryRun: false,
      origin: 'manual_retry',
    })
    assert.deepEqual(queued.payload.targetKeys, ['target-a', 'target-b'])
    assert.deepEqual(queued.payload.trf3Formats, ['csv', 'xlsx'])
    assert.deepEqual(queued.payload.trf3Months, [1, 2])
  })

  test('supports retry for DataJud and SIOP operational integration jobs', async ({ assert }) => {
    const cases = [
      {
        jobName: 'datajud-national-precatorio-sync',
        queueName: 'datajud-national-precatorio-sync',
        metadata: { courtAliases: ['tjsp'], pageSize: 20, maxPagesPerCourt: 3 },
      },
      {
        jobName: 'datajud-legal-signal-classifier',
        queueName: 'datajud-legal-signal-classifier',
        metadata: { limit: 30, processId: 'process-1', projectAssetEvents: false },
      },
      {
        jobName: 'datajud-process-asset-link',
        queueName: 'datajud-process-asset-link',
        metadata: { limit: 40, projectSignals: false },
      },
      {
        jobName: 'asset-intelligence-reconcile',
        queueName: 'asset-intelligence-reconcile',
        metadata: {
          limit: 15,
          dryRun: true,
          includeManualActions: false,
          maxActionsPerAsset: 2,
          recentActionCooldownHours: 1,
          useNationalCoherence: false,
        },
      },
      {
        jobName: 'siop-open-data-sync',
        queueName: 'siop-open-data-sync',
        metadata: { years: [2025, 2026], download: false, enqueueImports: false },
      },
      {
        jobName: 'tjsp-precatorio-sync',
        queueName: 'tjsp-precatorio-sync',
        metadata: {
          categories: ['municipal_entities'],
          limit: 12,
          downloadDetails: false,
          downloadDocuments: false,
          importDocuments: false,
        },
      },
    ]

    for (const item of cases) {
      const queued = await captureRetry(runFor(item.jobName, item.metadata))

      assert.equal(queued.queueName, item.queueName)
      assert.equal(queued.jobName, item.jobName)
      assert.equal(queued.payload.tenantId, 'tenant-1')
      assert.equal(queued.payload.origin, 'manual_retry')
    }
  })
})

async function captureRetry(run: RadarJobRun, requestId?: string) {
  const queued: QueuedJob[] = []
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
    queued.push({ queueName, jobName, payload, options })
    return { id: 'retry-job-id' }
  }

  try {
    await jobRetryService.retry(run, requestId)
  } finally {
    queue.add = originalAdd
  }

  return queued[0]
}

function runFor(jobName: string, metadata: JsonRecord): RadarJobRun {
  return {
    id: `run-${jobName}`,
    tenantId: 'tenant-1',
    jobName,
    status: 'failed',
    metadata,
  } as RadarJobRun
}
