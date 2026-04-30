import factory from '@adonisjs/lucid/factories'
import AssetScore from '#modules/precatorios/models/asset_score'
import { DateTime } from 'luxon'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { ensureTenantId } from '#database/factories/factory_helpers'

export const AssetScoreFactory = factory
  .define(AssetScore, async ({ faker }) => {
    return {
      scoreVersion: 'v0',
      finalScore: faker.number.float({ min: 0, max: 100, fractionDigits: 2 }),
      legalSignalScore: faker.number.float({ min: 0, max: 100, fractionDigits: 2 }),
      economicScore: faker.number.float({ min: 0, max: 100, fractionDigits: 2 }),
      liquidityScore: faker.number.float({ min: 0, max: 100, fractionDigits: 2 }),
      riskScore: faker.number.float({ min: 0, max: 100, fractionDigits: 2 }),
      maturityScore: faker.number.float({ min: 0, max: 100, fractionDigits: 2 }),
      dataQualityScore: faker.number.float({ min: 0, max: 100, fractionDigits: 2 }),
      explanation: {},
      computedAt: DateTime.now(),
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
