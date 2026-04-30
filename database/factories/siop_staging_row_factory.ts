import factory from '@adonisjs/lucid/factories'
import SiopStagingRow from '#modules/siop/models/siop_staging_row'
import { SiopImportFactory } from '#database/factories/siop_import_factory'

export const SiopStagingRowFactory = factory
  .define(SiopStagingRow, async ({ faker }) => {
    return {
      rawData: {
        row: faker.number.int({ min: 1, max: 100_000 }),
      },
      validationStatus: 'pending' as const,
      errors: { messages: [] },
    }
  })
  .before('create', async (_, row) => {
    if (!row.importId) {
      const siopImport = await SiopImportFactory.create()
      row.importId = siopImport.id
    }
  })
  .build()
