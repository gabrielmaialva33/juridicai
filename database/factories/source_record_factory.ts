import factory from '@adonisjs/lucid/factories'
import SourceRecord from '#modules/siop/models/source_record'
import { DateTime } from 'luxon'
import { TenantFactory } from '#database/factories/tenant_factory'

export const SourceRecordFactory = factory
  .define(SourceRecord, async ({ faker }) => {
    const tenant = await TenantFactory.create()

    return {
      tenantId: tenant.id,
      source: 'siop' as const,
      sourceUrl: faker.internet.url(),
      originalFilename: `siop-${faker.date.past().getFullYear()}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sourceChecksum: faker.string.hexadecimal({ length: 64, prefix: '' }),
      rawData: {},
      collectedAt: DateTime.now(),
    }
  })
  .build()
