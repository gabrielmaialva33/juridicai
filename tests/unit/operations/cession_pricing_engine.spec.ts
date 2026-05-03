import { test } from '@japa/runner'
import cessionPricingEngine from '#modules/operations/services/cession_pricing_engine'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import { AssetEventFactory } from '#database/factories/asset_event_factory'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import type AssetEvent from '#modules/precatorios/models/asset_event'
import type Tenant from '#modules/tenant/models/tenant'

test.group('cession pricing engine', () => {
  test('uses tribunal operational signals to shorten expected terms and improve payment probability', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const asset = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      nature: 'comum',
      lifecycleStatus: 'discovered',
      faceValue: '500000.00',
      estimatedUpdatedValue: '500000.00',
      queuePosition: 12,
    }).create()
    await AssetEventFactory.merge({
      tenantId: tenant.id,
      assetId: asset.id,
      eventType: 'direct_agreement_window',
      source: 'tribunal',
      idempotencyKey: 'pricing-direct-agreement-window',
    }).create()
    await AssetEventFactory.merge({
      tenantId: tenant.id,
      assetId: asset.id,
      eventType: 'queue_position_favorable',
      source: 'tribunal',
      idempotencyKey: 'pricing-queue-position-favorable',
    }).create()
    const loaded = await assetWithPricingRelations(tenant.id, asset.id)

    const projection = cessionPricingEngine.project(loaded, {
      debtor: loaded.debtor,
      events: loaded.events as AssetEvent[],
    })

    assert.equal(projection.pricing.termMonths, 18)
    assert.isAbove(projection.pricing.paymentProbability, 0.55)
    assert.equal(projection.pricing.explanation.scoreBreakdown.riskAdjustedIrr.weight, 0.4)
    assert.include(projection.pricing.explanation.headline, `Grade ${projection.pricing.grade}`)
    assert.include(projection.pricing.explanation.summary, 'risk-adjusted IRR')
    assert.include(
      projection.pricing.explanation.signalImpacts.map((signal) => signal.code),
      'direct_agreement_window'
    )
    assert.isTrue(
      projection.pricing.explanation.pricingFactors.some(
        (factor) => factor.key === 'estimated_term' && factor.impact === 'positive'
      )
    )
    assert.include(
      projection.signals.positive.map((signal) => signal.code),
      'direct_agreement_window'
    )
    assert.include(
      projection.signals.positive.map((signal) => signal.code),
      'queue_position_favorable'
    )

    await cleanupTenantData(tenant)
  })
})

async function assetWithPricingRelations(tenantId: string, assetId: string) {
  return PrecatorioAsset.query()
    .where('tenant_id', tenantId)
    .where('id', assetId)
    .preload('debtor', (query) =>
      query.preload('paymentStats', (statsQuery) => statsQuery.orderBy('computed_at', 'desc'))
    )
    .preload('events')
    .preload('valuations', (query) => query.orderBy('computed_at', 'desc').limit(1))
    .firstOrFail()
}

async function cleanupTenantData(tenant: Tenant) {
  await tenant.delete()
}
