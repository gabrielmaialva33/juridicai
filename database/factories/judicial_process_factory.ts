import factory from '@adonisjs/lucid/factories'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import { DateTime } from 'luxon'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'

export const JudicialProcessFactory = factory
  .define(JudicialProcess, async ({ faker }) => {
    const asset = await PrecatorioAssetFactory.create()

    return {
      tenantId: asset.tenantId,
      assetId: asset.id,
      source: 'siop',
      cnjNumber: asset.cnjNumber ?? faker.string.uuid(),
      filedAt: DateTime.now(),
      subject: faker.lorem.words({ min: 3, max: 8 }),
      rawData: {},
    }
  })
  .build()
