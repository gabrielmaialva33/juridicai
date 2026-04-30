import factory from '@adonisjs/lucid/factories'
import AssetEvent from '#modules/precatorios/models/asset_event'
import { DateTime } from 'luxon'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { ensureTenantId } from '#database/factories/factory_helpers'

export const AssetEventFactory = factory
  .define(AssetEvent, async ({ faker }) => {
    return {
      eventType: 'imported',
      eventDate: DateTime.now(),
      source: 'siop' as const,
      payload: {},
      idempotencyKey: faker.string.uuid(),
    }
  })
  .before('create', async (_, row) => {
    const tenantId = await ensureTenantId(row)

    if (!row.assetId) {
      const asset = await PrecatorioAssetFactory.merge({ tenantId }).create()
      row.assetId = asset.id
    }
  })
  .build()
