import factory from '@adonisjs/lucid/factories'
import Publication from '#modules/precatorios/models/publication'
import { DateTime } from 'luxon'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { ensureTenantId } from '#database/factories/factory_helpers'

export const PublicationFactory = factory
  .define(Publication, async ({ faker }) => {
    return {
      source: 'siop' as const,
      publicationDate: DateTime.now(),
      title: faker.lorem.sentence(),
      body: faker.lorem.paragraphs({ min: 1, max: 3 }),
      textHash: faker.string.hexadecimal({ length: 64, prefix: '' }),
      rawData: {},
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
