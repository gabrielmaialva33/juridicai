import { test } from '@japa/runner'
import CessionOpportunity from '#modules/operations/models/cession_opportunity'
import CessionPricing from '#modules/operations/models/cession_pricing'
import CessionStageHistory from '#modules/operations/models/cession_stage_history'
import postImportOperationalIntakeService from '#modules/operations/services/post_import_operational_intake_service'
import AssetScore from '#modules/precatorios/models/asset_score'
import { AssetEventFactory } from '#database/factories/asset_event_factory'
import { DebtorFactory } from '#database/factories/debtor_factory'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { SourceRecordFactory } from '#database/factories/source_record_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

test.group('post import operational intake service', () => {
  test('refreshes legal scores and creates inbox opportunities for qualified imported assets', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await SourceRecordFactory.merge({
      tenantId: tenant.id,
      source: 'tribunal',
    }).create()
    const debtor = await DebtorFactory.merge({
      tenantId: tenant.id,
      name: 'Instituto Nacional do Seguro Social',
      normalizedName: 'INSTITUTO NACIONAL DO SEGURO SOCIAL',
      debtorType: 'autarchy',
      paymentRegime: 'federal_unique',
      paymentReliabilityScore: 96,
    }).create()
    const asset = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      sourceRecordId: sourceRecord.id,
      source: 'tribunal',
      debtorId: debtor.id,
      nature: 'alimentar',
      lifecycleStatus: 'in_payment',
      faceValue: '1247892.00',
      estimatedUpdatedValue: '1247892.00',
      currentScore: null,
      currentScoreId: null,
    }).create()
    await AssetEventFactory.merge({
      tenantId: tenant.id,
      assetId: asset.id,
      eventType: 'payment_available',
      source: 'tribunal',
      idempotencyKey: 'intake-payment-available',
    }).create()
    await AssetEventFactory.merge({
      tenantId: tenant.id,
      assetId: asset.id,
      eventType: 'superpreference_granted',
      source: 'tribunal',
      idempotencyKey: 'intake-superpreference',
    }).create()

    const result = await postImportOperationalIntakeService.run({
      tenantId: tenant.id,
      sourceRecordId: sourceRecord.id,
    })
    const refreshed = await asset.refresh()
    const score = await AssetScore.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .firstOrFail()
    const opportunity = await CessionOpportunity.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .firstOrFail()
    const pricing = await CessionPricing.query()
      .where('tenant_id', tenant.id)
      .where('opportunity_id', opportunity.id)
      .firstOrFail()
    const history = await CessionStageHistory.query()
      .where('tenant_id', tenant.id)
      .where('opportunity_id', opportunity.id)
      .firstOrFail()

    assert.equal(result.inspectedAssets, 1)
    assert.equal(result.scoresRefreshed, 1)
    assert.equal(result.scoresCreated, 1)
    assert.equal(result.opportunitiesCreated, 1)
    assert.equal(refreshed.currentScoreId, score.id)
    assert.equal(opportunity.stage, 'inbox')
    assert.equal(opportunity.currentPricingId, pricing.id)
    assert.isNotNull(opportunity.grade)
    assert.include(['A+', 'A', 'B+'], opportunity.grade!)
    assert.isAtLeast(Number(pricing.riskAdjustedIrr), 0.25)
    assert.equal(history.reason, 'post_import_operational_intake')

    await cleanupTenantData(tenant)
  })

  test('updates existing opportunities without moving their pipeline stage', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await SourceRecordFactory.merge({
      tenantId: tenant.id,
      source: 'tribunal',
    }).create()
    const asset = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      sourceRecordId: sourceRecord.id,
      source: 'tribunal',
      nature: 'alimentar',
      lifecycleStatus: 'in_payment',
      faceValue: '900000.00',
      estimatedUpdatedValue: '900000.00',
    }).create()
    const existing = await CessionOpportunity.create({
      tenantId: tenant.id,
      assetId: asset.id,
      stage: 'due_diligence',
      grade: 'B',
      priority: 45,
    })
    await AssetEventFactory.merge({
      tenantId: tenant.id,
      assetId: asset.id,
      eventType: 'payment_available',
      source: 'tribunal',
      idempotencyKey: 'intake-update-payment',
    }).create()

    const result = await postImportOperationalIntakeService.run({
      tenantId: tenant.id,
      sourceRecordId: sourceRecord.id,
    })
    const updated = await existing.refresh()
    const pricingCount = await CessionPricing.query()
      .where('tenant_id', tenant.id)
      .where('opportunity_id', existing.id)
      .count('* as total')
      .firstOrFail()

    assert.equal(result.opportunitiesCreated, 0)
    assert.equal(result.opportunitiesUpdated, 1)
    assert.equal(updated.stage, 'due_diligence')
    assert.equal(updated.priority, 45)
    assert.isNotNull(updated.currentPricingId)
    assert.equal(Number(pricingCount.$extras.total), 1)

    await cleanupTenantData(tenant)
  })
})

async function cleanupTenantData(tenant: Tenant) {
  await tenant.delete()
}
