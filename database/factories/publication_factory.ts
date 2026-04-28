import factory from '@adonisjs/lucid/factories'
import Publication from '#modules/precatorios/models/publication'
import { DateTime } from 'luxon'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'

export const PublicationFactory = factory
  .define(Publication, async ({ faker }) => {
    const asset = await PrecatorioAssetFactory.create()

    return {
      tenantId: asset.tenantId,
      assetId: asset.id,
      source: 'siop',
      publicationDate: DateTime.now(),
      title: faker.lorem.sentence(),
      body: faker.lorem.paragraphs({ min: 1, max: 3 }),
      textHash: faker.string.hexadecimal({ length: 64, prefix: '' }),
      rawData: {},
    }
  })
  .build()
