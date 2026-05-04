import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import assetIntelligenceReconcileService from '#modules/operations/services/asset_intelligence_reconcile_service'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { TenantFactory } from '#database/factories/tenant_factory'

test.group('asset intelligence reconcile service', () => {
  test('plans targeted enrichment actions for incomplete assets in dry-run mode', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const asset = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      source: 'siop',
      cnjNumber: '0702042-05.2020.8.07.0003',
      currentScore: null,
      currentScoreId: null,
    }).create()

    const result = await assetIntelligenceReconcileService.run({
      tenantId: tenant.id,
      dryRun: true,
      limit: 10,
      includeManualActions: false,
      recentActionCooldownHours: 0,
      requestId: 'asset-intelligence-reconcile-test',
    })

    assert.equal(result.dryRun, true)
    assert.equal(result.selectedAssets, 1)
    assert.equal(result.inspectedAssets, 1)
    assert.equal(result.actedAssets, 1)
    assert.isTrue(result.coherence.enabled)
    assert.include(result.coherence.targetedCourts, 'federal-siop')
    assert.equal(result.assets[0].assetId, asset.id)
    assert.equal(result.assets[0].courtAlias, 'federal-siop')
    assert.isAbove(result.assets[0].coherencePriority, 0)
    assert.include(result.assets[0].actionKeys, 'enrich_from_datajud')
    assert.isAtLeast(result.plannedActions, 1)

    const auditLog = await db
      .from('audit_logs')
      .where('tenant_id', tenant.id)
      .where('entity_id', asset.id)
      .where('event', 'asset_intelligence_actions_planned')
      .first()

    assert.equal(auditLog?.request_id, 'asset-intelligence-reconcile-test')

    await tenant.delete()
  })
})
