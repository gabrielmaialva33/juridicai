import factory from '@adonisjs/lucid/factories'
import SiopImport from '#modules/siop/models/siop_import'
import { SourceRecordFactory } from '#database/factories/source_record_factory'
import { TenantFactory } from '#database/factories/tenant_factory'

export const SiopImportFactory = factory
  .define(SiopImport, async ({ faker }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await SourceRecordFactory.merge({ tenantId: tenant.id }).create()

    return {
      tenantId: tenant.id,
      exerciseYear: faker.number.int({ min: 2010, max: 2026 }),
      sourceRecordId: sourceRecord.id,
      source: 'siop',
      status: 'pending',
      totalRows: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      rawMetadata: {},
    }
  })
  .build()
