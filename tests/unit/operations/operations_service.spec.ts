import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import operationsService from '#modules/operations/services/operations_service'
import assetIntelligenceActionService from '#modules/operations/services/asset_intelligence_action_service'
import CessionOpportunity from '#modules/operations/models/cession_opportunity'
import CessionPricing from '#modules/operations/models/cession_pricing'
import MarketRate from '#modules/market/models/market_rate'
import MarketRateSeries from '#modules/market/models/market_rate_series'
import { AssetEventFactory } from '#database/factories/asset_event_factory'
import { AssetScoreFactory } from '#database/factories/asset_score_factory'
import { DebtorPaymentStatFactory } from '#database/factories/debtor_payment_stat_factory'
import { DebtorFactory } from '#database/factories/debtor_factory'
import { JudicialProcessFactory } from '#database/factories/judicial_process_factory'
import { MarketRateFactory } from '#database/factories/market_rate_factory'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { PublicationEventFactory } from '#database/factories/publication_event_factory'
import { PublicationFactory } from '#database/factories/publication_factory'
import { SourceRecordFactory } from '#database/factories/source_record_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import { UserFactory } from '#database/factories/user_factory'
import type Tenant from '#modules/tenant/models/tenant'

test.group('operations service', () => {
  test('ranks tenant-scoped A+ opportunities from pricing and event signals', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const otherTenant = await TenantFactory.create()
    const selicSeries = await rateSeries('selic', '11', 'daily')
    await MarketRate.query().where('series_id', selicSeries.id).delete()
    const debtor = await DebtorFactory.merge({
      tenantId: tenant.id,
      name: 'Instituto Nacional do Seguro Social',
      normalizedName: 'INSTITUTO NACIONAL DO SEGURO SOCIAL',
      debtorType: 'autarchy',
      paymentRegime: 'federal_unique',
      paymentReliabilityScore: 96,
    }).create()
    await DebtorPaymentStatFactory.merge({
      tenantId: tenant.id,
      debtorId: debtor.id,
      averagePaymentMonths: 14,
      onTimePaymentRate: '0.960000',
      reliabilityScore: 96,
    }).create()
    await MarketRateFactory.merge({
      seriesId: selicSeries.id,
      rateDate: DateTime.fromISO('2026-05-01'),
      value: '0.0004900000',
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
    await CessionOpportunity.create({
      tenantId: tenant.id,
      assetId: strongAsset.id,
      stage: 'inbox',
      priority: 100,
    })
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
    assert.equal(
      result.opportunities[0].pricing.assumptions.correctionRule,
      'ec_136_min_ipca_plus_2_selic'
    )
    assert.equal(result.opportunities[0].debtor.averagePaymentMonths, 14)
    assert.isAtLeast(result.opportunities[0].pricing.riskAdjustedIrr, 0.25)

    await cleanupTenantData(tenant)
    await cleanupTenantData(otherTenant)
    await MarketRate.query().where('series_id', selicSeries.id).delete()
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
    const pricing = await CessionPricing.query()
      .where('tenant_id', tenant.id)
      .where('opportunity_id', persisted.id)
      .firstOrFail()
    assert.equal(persisted.currentPricingId, pricing.id)
    assert.equal(pricing.pricingSnapshot?.grade, result.opportunity.pricing.grade)
    assert.equal(result.opportunity.pricing.offerRate, 0.385)
    assert.equal(auditLog?.user_id, user.id)
    assert.equal(auditLog?.request_id, 'operations-request-1')

    await cleanupTenantData(tenant)
    await user.delete()
  })

  test('builds a coherent asset intelligence dossier from source, process, publication, and score evidence', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await SourceRecordFactory.merge({
      tenantId: tenant.id,
      source: 'siop',
      rawData: { providerId: 'siop-open-data-precatorios' },
    }).create()
    const debtor = await DebtorFactory.merge({
      tenantId: tenant.id,
      name: 'Instituto Nacional do Seguro Social',
      normalizedName: 'INSTITUTO NACIONAL DO SEGURO SOCIAL',
      normalizedKey: 'INSTITUTO NACIONAL DO SEGURO SOCIAL',
      debtorType: 'autarchy',
      paymentRegime: 'federal_unique',
    }).create()
    const asset = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      sourceRecordId: sourceRecord.id,
      debtorId: debtor.id,
      cnjNumber: '0001234-56.2024.4.03.6100',
      assetNumber: 'PRC-2026-1',
      courtName: 'Tribunal Regional Federal da 3a Regiao',
      courtCode: 'TRF3',
      courtClass: 'federal',
      budgetUnitCode: '33201',
      budgetUnitName: 'Instituto Nacional do Seguro Social',
      causeType: 'alimentar',
      faceValue: '1247892.00',
      estimatedUpdatedValue: '1320000.00',
      currentScore: 92,
    }).create()
    await AssetScoreFactory.merge({
      tenantId: tenant.id,
      assetId: asset.id,
      finalScore: 92,
      dataQualityScore: 90,
      legalSignalScore: 80,
      economicScore: 75,
      liquidityScore: 82,
      riskScore: 20,
      maturityScore: 85,
    }).create()
    await db.table('asset_source_links').insert({
      tenant_id: tenant.id,
      asset_id: asset.id,
      source_record_id: sourceRecord.id,
      link_type: 'cross_check',
      confidence: '0.9500',
      match_reason: 'siop_cnj_match',
      matched_fields: { cnjNumber: '0001234-56.2024.4.03.6100' },
      normalized_payload: {
        cnjNumber: '0001234-56.2024.4.03.6100',
        debtorName: 'Instituto Nacional do Seguro Social',
      },
      raw_pointer: { row: 1 },
    })
    await db.table('external_identifiers').multiInsert([
      {
        tenant_id: tenant.id,
        asset_id: asset.id,
        source_record_id: sourceRecord.id,
        identifier_type: 'cnj_number',
        identifier_value: '0001234-56.2024.4.03.6100',
        normalized_value: '00012345620244036100',
        issuer: 'SIOP',
        confidence: '1.0000',
        is_primary: true,
        raw_data: {},
      },
      {
        tenant_id: tenant.id,
        asset_id: asset.id,
        source_record_id: sourceRecord.id,
        identifier_type: 'cnj_number',
        identifier_value: '9999999-99.2024.4.03.6100',
        normalized_value: '99999999920244036100',
        issuer: 'TRIBUNAL',
        confidence: '0.6000',
        is_primary: false,
        raw_data: {},
      },
    ])
    await JudicialProcessFactory.merge({
      tenantId: tenant.id,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      source: 'datajud',
      cnjNumber: '0001234-56.2024.4.03.6100',
      courtAlias: 'trf3',
    }).create()
    const publication = await PublicationFactory.merge({
      tenantId: tenant.id,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      source: 'djen',
      body: 'Pagamento disponibilizado para o precatorio.',
    }).create()
    await PublicationEventFactory.merge({
      tenantId: tenant.id,
      publicationId: publication.id,
      eventType: 'payment_available',
      idempotencyKey: 'operations-dossier-payment-available',
    }).create()
    await AssetEventFactory.merge({
      tenantId: tenant.id,
      assetId: asset.id,
      eventType: 'prior_cession_detected',
      source: 'djen',
      idempotencyKey: 'operations-dossier-prior-cession',
    }).create()

    const result = await operationsService.dossier(tenant.id, asset.id)

    assert.equal(result.intelligence.canonicalIdentity.assetId, asset.id)
    assert.equal(result.intelligence.relationshipMap.judicialProcessIds.length, 1)
    assert.isAtLeast(result.intelligence.completeness.score, 85)
    assert.equal(result.intelligence.confidence.acceptedProcess, true)
    assert.isTrue(
      result.intelligence.conflicts.some((conflict) => conflict.key === 'cnj_identifier_mismatch')
    )
    assert.isTrue(
      result.intelligence.legalSignals.positive.some(
        (signal) => signal.code === 'payment_available'
      )
    )
    assert.isTrue(
      result.intelligence.legalSignals.negative.some(
        (signal) => signal.code === 'prior_cession_detected'
      )
    )
    assert.isTrue(
      result.intelligence.nextBestActions.some(
        (action) => action.key === 'resolve_high_severity_conflicts'
      )
    )

    const actions = await assetIntelligenceActionService.run(tenant.id, asset.id, {
      actions: ['resolve_high_severity_conflicts', 'recompute_asset_score'],
      dryRun: true,
      requestId: 'asset-intelligence-actions-test',
    })

    assert.equal(actions.dryRun, true)
    assert.isTrue(
      actions.results.some(
        (action) => action.key === 'resolve_high_severity_conflicts' && action.status === 'manual'
      )
    )
    assert.isTrue(
      actions.results.some(
        (action) => action.key === 'recompute_asset_score' && action.status === 'planned'
      )
    )

    await cleanupTenantData(tenant)
  })

  test('deduplicates court-level government sync actions within the same window', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const firstAsset = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      courtCode: 'trf1',
      courtName: 'Tribunal Regional Federal da 1a Regiao',
    }).create()
    const secondAsset = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      courtCode: 'trf1',
      courtName: 'Tribunal Regional Federal da 1a Regiao',
    }).create()

    const firstActions = await assetIntelligenceActionService.run(tenant.id, firstAsset.id, {
      actions: ['sync_djen_publications'],
      dryRun: true,
      requestId: 'court-sync-dedupe-test',
    })
    const secondActions = await assetIntelligenceActionService.run(tenant.id, secondAsset.id, {
      actions: ['sync_djen_publications'],
      dryRun: true,
      requestId: 'court-sync-dedupe-test',
    })

    const firstJobId = firstActions.results[0].jobId
    const secondJobId = secondActions.results[0].jobId

    assert.equal(firstJobId, secondJobId)
    assert.notInclude(firstJobId!, firstAsset.id)
    assert.include(firstJobId!, 'sync_djen_publications-trf1')

    await cleanupTenantData(tenant)
  })
})

async function cleanupTenantData(tenant: Tenant) {
  await tenant.delete()
}

function rateSeries(key: 'selic', code: string, periodicity: 'daily') {
  return MarketRateSeries.updateOrCreate(
    { key },
    {
      key,
      code,
      source: 'test',
      periodicity,
      unit: 'decimal_rate',
      description: null,
    }
  )
}
