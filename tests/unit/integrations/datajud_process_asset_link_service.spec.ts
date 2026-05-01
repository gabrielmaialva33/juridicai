import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import dataJudProcessAssetLinkService from '#modules/integrations/services/datajud_process_asset_link_service'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetScore from '#modules/precatorios/models/asset_score'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import JudicialProcessSignal from '#modules/precatorios/models/judicial_process_signal'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

test.group('DataJud process asset link service', () => {
  test('links exact CNJ processes and projects existing signals to the asset score', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const asset = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      cnjNumber: '1006611-83.2024.8.26.0624',
    }).create()
    const process = await JudicialProcess.create({
      tenantId: tenant.id,
      assetId: null,
      sourceRecordId: null,
      source: 'datajud',
      cnjNumber: asset.cnjNumber!,
      courtAlias: 'tjsp',
      filedAt: DateTime.fromISO('2024-01-10'),
      rawData: {},
    })

    await JudicialProcessSignal.create({
      tenantId: tenant.id,
      processId: process.id,
      movementId: null,
      signalCode: 'requisition_issued',
      polarity: 'positive',
      confidence: 96,
      detectedAt: DateTime.fromISO('2025-04-04T13:22:17.000Z'),
      source: 'datajud',
      evidence: { movementCode: 12457 },
      idempotencyKey: 'signal-requisition',
    })

    const metrics = await dataJudProcessAssetLinkService.link({
      tenantId: tenant.id,
      limit: 20,
    })

    assert.include(metrics, {
      selectedProcesses: 1,
      linked: 1,
      signalEventsProjected: 1,
      assetScoresRefreshed: 1,
      assetScoresCreated: 1,
    })

    await process.refresh()
    await asset.refresh()

    const event = await AssetEvent.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .where('event_type', 'requisition_issued')
      .firstOrFail()

    assert.equal(process.assetId, asset.id)
    assert.equal(event.source, 'datajud')
    assert.equal(event.payload?.projectedBy, 'datajud_exact_cnj_link')
    assert.isNotNull(asset.currentScoreId)
    assert.equal(await countAssetScores(tenant.id), 1)

    const secondRun = await dataJudProcessAssetLinkService.link({
      tenantId: tenant.id,
      limit: 20,
    })

    assert.equal(secondRun.selectedProcesses, 0)
    assert.equal(await countAssetEvents(tenant.id), 1)
    assert.equal(await countAssetScores(tenant.id), 1)

    await cleanupTenantData(tenant)
  })

  test('counts missing assets when no exact CNJ asset exists', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    await JudicialProcess.create({
      tenantId: tenant.id,
      assetId: null,
      sourceRecordId: null,
      source: 'datajud',
      cnjNumber: '1006611-83.2024.8.26.0624',
      courtAlias: 'tjsp',
      filedAt: DateTime.fromISO('2024-01-10'),
      rawData: {},
    })

    const metrics = await dataJudProcessAssetLinkService.link({
      tenantId: tenant.id,
      limit: 20,
    })

    assert.equal(metrics.selectedProcesses, 1)
    assert.equal(metrics.linked, 0)
    assert.equal(metrics.missingAsset, 1)

    await cleanupTenantData(tenant)
  })
})

async function countAssetEvents(tenantId: string) {
  const [result] = await AssetEvent.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}

async function countAssetScores(tenantId: string) {
  const [result] = await AssetScore.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}

async function cleanupTenantData(tenant: Tenant) {
  await tenant.delete()
}
