import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import operationsService from '#modules/operations/services/operations_service'
import CessionOpportunity from '#modules/operations/models/cession_opportunity'
import { AssetEventFactory } from '#database/factories/asset_event_factory'
import { DebtorFactory } from '#database/factories/debtor_factory'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import { UserFactory } from '#database/factories/user_factory'
import type Tenant from '#modules/tenant/models/tenant'

test.group('operations service', () => {
  test('ranks tenant-scoped A+ opportunities from pricing and event signals', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const otherTenant = await TenantFactory.create()
    const debtor = await DebtorFactory.merge({
      tenantId: tenant.id,
      name: 'Instituto Nacional do Seguro Social',
      normalizedName: 'INSTITUTO NACIONAL DO SEGURO SOCIAL',
      debtorType: 'autarchy',
      paymentRegime: 'federal_unique',
      paymentReliabilityScore: 96,
    }).create()
    const strongAsset = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      debtorId: debtor.id,
      nature: 'alimentar',
      lifecycleStatus: 'in_payment',
      faceValue: '5000000.00',
      estimatedUpdatedValue: '5000000.00',
      currentScore: 95,
    }).create()
    await AssetEventFactory.merge({
      tenantId: tenant.id,
      assetId: strongAsset.id,
      eventType: 'payment_available',
      source: 'djen',
      idempotencyKey: 'payment-available-test',
    }).create()
    await PrecatorioAssetFactory.merge({
      tenantId: otherTenant.id,
      faceValue: '5000000.00',
      estimatedUpdatedValue: '5000000.00',
      lifecycleStatus: 'in_payment',
    }).create()

    const result = await operationsService.list(tenant.id, {
      page: 1,
      limit: 10,
      grade: 'A+',
    })

    assert.equal(result.meta.total, 1)
    assert.equal(result.opportunities[0].asset.id, strongAsset.id)
    assert.equal(result.opportunities[0].pricing.grade, 'A+')
    assert.isAtLeast(result.opportunities[0].pricing.riskAdjustedIrr, 0.25)

    await cleanupTenantData(tenant)
    await cleanupTenantData(otherTenant)
  })

  test('moves assets into the cession pipeline with a pricing snapshot and audit log', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const asset = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      faceValue: '1247892.00',
      estimatedUpdatedValue: '1247892.00',
      nature: 'alimentar',
    }).create()
    const user = await UserFactory.create()

    const result = await operationsService.moveToPipeline(tenant.id, asset.id, {
      stage: 'offer',
      offerRate: 0.385,
      termMonths: 18,
      priority: 90,
      userId: user.id,
      requestId: 'operations-request-1',
    })
    const persisted = await CessionOpportunity.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .firstOrFail()
    const auditLog = await db
      .from('audit_logs')
      .where('tenant_id', tenant.id)
      .where('event', 'cession_opportunity_moved')
      .first()

    assert.equal(result.opportunity.pipeline.stage, 'offer')
    assert.equal(persisted.stage, 'offer')
    assert.equal(persisted.priority, 90)
    assert.equal(persisted.pricingSnapshot?.grade, result.opportunity.pricing.grade)
    assert.equal(result.opportunity.pricing.offerRate, 0.385)
    assert.equal(auditLog?.user_id, user.id)
    assert.equal(auditLog?.request_id, 'operations-request-1')

    await cleanupTenantData(tenant)
    await user.delete()
  })
})

async function cleanupTenantData(tenant: Tenant) {
  await tenant.delete()
}
