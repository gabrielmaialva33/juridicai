import factory from '@adonisjs/lucid/factories'
import SourceRecord from '#modules/siop/models/source_record'
import { DateTime } from 'luxon'
import { ensureTenantId } from '#database/factories/factory_helpers'

export const SourceRecordFactory = factory
  .define(SourceRecord, async ({ faker }) => {
    return {
      source: 'siop' as const,
      sourceUrl: faker.internet.url(),
      originalFilename: `siop-${faker.date.past().getFullYear()}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sourceChecksum: faker.string.hexadecimal({ length: 64, prefix: '' }),
      rawData: {},
      collectedAt: DateTime.now(),
    }
  })
  .before('create', async (_, row) => {
    await ensureTenantId(row)
  })
  .build()
