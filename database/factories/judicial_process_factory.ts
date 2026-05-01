import factory from '@adonisjs/lucid/factories'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import { DateTime } from 'luxon'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { ensureTenantId } from '#database/factories/factory_helpers'

export const JudicialProcessFactory = factory
  .define(JudicialProcess, async ({ faker }) => {
    return {
      source: 'siop' as const,
      cnjNumber: `${faker.string.numeric(7)}-${faker.string.numeric(2)}.${faker.string.numeric(4)}.4.01.${faker.string.numeric(4)}`,
      filedAt: DateTime.now(),
      rawData: {},
    }
  })
  .before('create', async (_, row) => {
    const tenantId = await ensureTenantId(row)

    if (!row.assetId) {
      const asset = await PrecatorioAssetFactory.merge({
        tenantId,
        cnjNumber: row.cnjNumber,
      }).create()
      row.assetId = asset.id
    }
  })
  .build()
