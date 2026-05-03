import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import governmentDataSyncOrchestratorService from '#modules/integrations/services/government_data_sync_orchestrator_service'
import GovernmentSourceTarget from '#modules/integrations/models/government_source_target'
import SourceDataset from '#modules/integrations/models/source_dataset'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'

test.group('Government data sync orchestrator service', () => {
  test('includes a coverage-driven execution plan in dry runs', async ({ assert }) => {
    await cleanupOrchestratorCoverageTestArtifacts()

    const tenant = await TenantFactory.create()
    const suffix = tenant.id
    const primaryDataset = await createDataset({
      key: `orchestrator-coverage-primary-${suffix}`,
      source: 'tribunal',
      priority: 'primary',
    })
    const dataJudDataset = await createDataset({
      key: `orchestrator-coverage-datajud-${suffix}`,
      source: 'datajud',
      priority: 'enrichment',
    })
    const primaryTarget = await createTarget({
      sourceDatasetId: primaryDataset.id,
      key: `orchestrator-coverage:tjac-primary:${suffix}`,
      source: 'tribunal',
      priority: 'primary',
      adapterKey: 'test_tjac_precatorio_sync',
      sourceUrl: 'https://example.test/tjac/precatorios',
      lastDiscoveredCount: 3,
      lastSourceRecordsCount: 1,
    })
    const dataJudTarget = await createTarget({
      sourceDatasetId: dataJudDataset.id,
      key: `orchestrator-coverage:tjac-datajud:${suffix}`,
      source: 'datajud',
      priority: 'enrichment',
      adapterKey: 'datajud_precatorio_discovery',
      sourceUrl: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjac/_search',
      lastDiscoveredCount: 2,
      lastSourceRecordsCount: 1,
    })
    const sourceRecord = await SourceRecord.create({
      tenantId: tenant.id,
      sourceDatasetId: primaryDataset.id,
      source: 'tribunal',
      sourceUrl: 'https://example.test/tjac/precatorios/lista.csv',
      sourceChecksum: `orchestrator-coverage-${suffix}`,
      originalFilename: 'lista.csv',
      mimeType: 'text/csv',
      fileSizeBytes: 128,
      collectedAt: DateTime.now(),
      rawData: { courtAlias: 'tjac' },
    })

    const result = await governmentDataSyncOrchestratorService.run({
      tenantId: tenant.id,
      years: [2026],
      dryRun: true,
    })

    assert.equal(result.dryRun, true)
    assert.deepEqual(result.years, [2026])
    assert.exists(result.coveragePlan)
    assert.exists(result.coverageRecoveryPlan)

    const coveragePlan = result.coveragePlan!
    const coverageRecoveryPlan = result.coverageRecoveryPlan!
    const tribunalPhase = result.phases.tribunalSourceDiscovery as {
      targetKeys: string[]
      adapterKeys: string[] | null
      recoveryPriority: Array<{
        targetKey: string
        priority: string
        priorityScore: number
        reasons: string[]
      }>
    }
    const acreTarget = coveragePlan.primarySyncTargets.find((target) => target.stateCode === 'AC')
    const recoveryTarget = coverageRecoveryPlan.targets.find(
      (target) => target.targetKey === primaryTarget.key
    )

    assert.equal(coveragePlan.summary.statesCount, 27)
    assert.include(tribunalPhase.targetKeys, primaryTarget.key)
    assert.isNull(tribunalPhase.adapterKeys)
    assert.isArray(tribunalPhase.recoveryPriority)
    assert.include(coverageRecoveryPlan.executableTargetKeys, primaryTarget.key)
    assert.equal(recoveryTarget?.priority, 'low')
    assert.isAbove(recoveryTarget?.priorityScore ?? 0, 0)
    assert.equal(acreTarget?.targetKey, primaryTarget.key)
    assert.equal(acreTarget?.tenantSourceRecordsCount, 1)
    assert.isTrue(
      coveragePlan.enrichmentTargets.some(
        (target) => target.stateCode === 'AC' && target.datajudStatus === 'validated'
      )
    )
    assert.isTrue(
      coveragePlan.adapterBacklog.some((gap) =>
        ['primary_source_missing', 'primary_source_mapped_without_adapter'].includes(gap.code)
      )
    )

    await sourceRecord.delete()
    await primaryTarget.delete()
    await dataJudTarget.delete()
    await primaryDataset.delete()
    await dataJudDataset.delete()
    await tenant.delete()
  })
})

async function cleanupOrchestratorCoverageTestArtifacts() {
  await SourceRecord.query().where('source_checksum', 'like', 'orchestrator-coverage-%').delete()
  await GovernmentSourceTarget.query().where('key', 'like', 'orchestrator-coverage:%').delete()
  await SourceDataset.query().where('key', 'like', 'orchestrator-coverage-%').delete()
}

async function createDataset(input: {
  key: string
  source: 'tribunal' | 'datajud'
  priority: 'primary' | 'enrichment'
}) {
  return SourceDataset.create({
    key: input.key,
    name: input.key,
    owner: 'Orchestrator Coverage Test',
    source: input.source,
    federativeLevel: 'state',
    kind: input.source === 'datajud' ? 'public_search_api' : 'tribunal_publication',
    access: 'public',
    priority: input.priority,
    baseUrl: 'https://example.test',
    stateCode: 'AC',
    courtAlias: 'tjac',
    format: input.source === 'datajud' ? 'json' : 'html/csv',
    notes: 'Generated by orchestrator coverage tests.',
    metadata: { testRun: true },
    isActive: true,
  })
}

async function createTarget(input: {
  sourceDatasetId: string
  key: string
  source: 'tribunal' | 'datajud'
  priority: 'primary' | 'enrichment'
  adapterKey: string
  sourceUrl: string
  lastDiscoveredCount: number
  lastSourceRecordsCount: number
}) {
  return GovernmentSourceTarget.create({
    sourceDatasetId: input.sourceDatasetId,
    key: input.key,
    name: input.key,
    source: input.source,
    federativeLevel: 'state',
    stateCode: 'AC',
    courtAlias: 'tjac',
    branch: 'state_court',
    priority: input.priority,
    adapterKey: input.adapterKey,
    sourceUrl: input.sourceUrl,
    sourceFormat: input.source === 'datajud' ? 'json' : 'html/csv',
    status: 'implemented',
    cadence: 'daily',
    isActive: true,
    lastSuccessAt: DateTime.now(),
    lastDiscoveredCount: input.lastDiscoveredCount,
    lastSourceRecordsCount: input.lastSourceRecordsCount,
    coverageScore: '0.9900',
    metadata: { testRun: true },
  })
}
