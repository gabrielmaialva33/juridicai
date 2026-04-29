import factory from '@adonisjs/lucid/factories'
import AssetEvent from '#modules/precatorios/models/asset_event'
import { DateTime } from 'luxon'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'

export const AssetEventFactory = factory
  .define(AssetEvent, async ({ faker }) => {
    const asset = await PrecatorioAssetFactory.create()

    return {
      tenantId: asset.tenantId,
      assetId: asset.id,
      eventType: 'imported',
      eventDate: DateTime.now(),
      source: 'siop' as const,
      payload: {},
      idempotencyKey: faker.string.uuid(),
    }
  })
  .build()
