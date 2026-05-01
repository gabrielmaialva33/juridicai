import factory from '@adonisjs/lucid/factories'
import CessionOpportunity from '#modules/operations/models/cession_opportunity'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { ensureTenantId } from '#database/factories/factory_helpers'

export const CessionOpportunityFactory = factory
  .define(CessionOpportunity, ({ faker }) => {
    return {
      stage: 'qualified' as const,
      priority: faker.number.int({ min: 0, max: 100 }),
      metadata: {},
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
