import SiopStagingRow from '#modules/siop/models/siop_staging_row'
import type { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { JsonRecord, StagingValidationStatus } from '#shared/types/model_enums'

class SiopStagingRowRepository {
  query() {
    return SiopStagingRow.query()
  }

  listByImport(importId: string, page = 1, perPage = 50) {
    return this.query().where('import_id', importId).paginate(page, perPage)
  }

  listInvalidByImport(importId: string, limit = 25) {
    return this.query()
      .where('import_id', importId)
      .where('validation_status', 'invalid')
      .orderBy('created_at', 'desc')
      .limit(limit)
  }

  paginateInvalidByImport(importId: string, page = 1, perPage = 50) {
    return this.query()
      .where('import_id', importId)
      .where('validation_status', 'invalid')
      .orderBy('created_at', 'desc')
      .paginate(page, perPage)
  }

  countInvalid(importId: string) {
    return this.query()
      .where('import_id', importId)
      .where('validation_status', 'invalid')
      .count('* as total')
  }

  createProcessed(
    input: {
      importId: string
      rawData: JsonRecord
      normalizedCnj: string | null
      normalizedDebtorKey: string | null
      normalizedValue: string | null
      normalizedYear: number | null
      validationStatus: StagingValidationStatus
      errors: JsonRecord | null
      processedAt: DateTime
    },
    trx: TransactionClientContract
  ) {
    return SiopStagingRow.create(input, { client: trx })
  }

  deleteByImport(importId: string, trx: TransactionClientContract) {
    return SiopStagingRow.query({ client: trx }).where('import_id', importId).delete()
  }
}

export default new SiopStagingRowRepository()
