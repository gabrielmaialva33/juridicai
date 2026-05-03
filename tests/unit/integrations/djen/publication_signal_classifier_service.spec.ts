import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import publicationSignalClassifierService from '#modules/integrations/services/publication_signal_classifier_service'
import AssetEvent from '#modules/precatorios/models/asset_event'
import Publication from '#modules/precatorios/models/publication'
import PublicationEvent from '#modules/precatorios/models/publication_event'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

test.group('Publication signal classifier service', () => {
  test('classifies publication text into publication events and asset events idempotently', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const asset = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      cnjNumber: '0001234-94.2024.4.01.3400',
    }).create()
    const publication = await Publication.create({
      tenantId: tenant.id,
      assetId: asset.id,
      source: 'djen',
      publicationDate: DateTime.fromISO('2026-05-01'),
      title: 'Intimacao de pagamento',
      body: [
        'Pagamento disponibilizado nos autos.',
        'Consta cessao de credito anterior para terceiro cessionario.',
      ].join(' '),
      textHash: `publication-signal-${tenant.id}`,
      rawData: {
        source: 'fixture',
      },
    })

    const firstRun = await publicationSignalClassifierService.classify({
      tenantId: tenant.id,
      publicationId: publication.id,
      projectAssetEvents: true,
    })
    const secondRun = await publicationSignalClassifierService.classify({
      tenantId: tenant.id,
      publicationId: publication.id,
      projectAssetEvents: true,
    })

    assert.include(firstRun, {
      selectedPublications: 1,
      matchedSignals: 2,
      publicationEventsUpserted: 2,
      assetEventsUpserted: 2,
      assetScoresRefreshed: 1,
    })
    assert.include(secondRun, {
      selectedPublications: 1,
      matchedSignals: 2,
      publicationEventsUpserted: 2,
      assetEventsUpserted: 2,
      assetScoresRefreshed: 1,
    })

    const publicationEvents = await PublicationEvent.query()
      .where('tenant_id', tenant.id)
      .orderBy('event_type', 'asc')
    const assetEvents = await AssetEvent.query()
      .where('tenant_id', tenant.id)
      .whereIn('event_type', ['payment_available', 'prior_cession_detected'])
      .orderBy('event_type', 'asc')

    assert.lengthOf(publicationEvents, 2)
    assert.deepEqual(
      publicationEvents.map((event) => event.eventType),
      ['payment_available', 'prior_cession_detected']
    )
    assert.lengthOf(assetEvents, 2)
    assert.deepEqual(
      assetEvents.map((event) => event.eventType),
      ['payment_available', 'prior_cession_detected']
    )
    assert.equal(assetEvents[0].payload?.publicationId, publication.id)

    await cleanupTenantData(tenant)
  })
})

async function cleanupTenantData(tenant: Tenant) {
  await tenant.delete()
}
