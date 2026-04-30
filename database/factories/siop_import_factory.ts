import factory from '@adonisjs/lucid/factories'
import SiopImport from '#modules/siop/models/siop_import'
import { SourceRecordFactory } from '#database/factories/source_record_factory'
import { ensureTenantId } from '#database/factories/factory_helpers'

export const SiopImportFactory = factory
  .define(SiopImport, async ({ faker }) => {
    return {
      exerciseYear: faker.number.int({ min: 2010, max: 2026 }),
      source: 'siop' as const,
      status: 'pending' as const,
      totalRows: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      rawMetadata: {},
    }
  })
  .before('create', async (_, row) => {
    const tenantId = await ensureTenantId(row)

    if (!row.sourceRecordId) {
      const sourceRecord = await SourceRecordFactory.merge({ tenantId }).create()
      row.sourceRecordId = sourceRecord.id
    }
  })
  .build()
