import factory from '@adonisjs/lucid/factories'
import SiopStagingRow from '#modules/siop/models/siop_staging_row'
import { SiopImportFactory } from '#database/factories/siop_import_factory'

export const SiopStagingRowFactory = factory
  .define(SiopStagingRow, async ({ faker }) => {
    const siopImport = await SiopImportFactory.create()

    return {
      importId: siopImport.id,
      rawData: {
        row: faker.number.int({ min: 1, max: 100_000 }),
      },
      validationStatus: 'pending',
      errors: [],
    }
  })
  .build()
