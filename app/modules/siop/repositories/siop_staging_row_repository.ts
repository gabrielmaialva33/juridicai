import SiopStagingRow from '#modules/siop/models/siop_staging_row'

class SiopStagingRowRepository {
  query() {
    return SiopStagingRow.query()
  }

  listByImport(importId: string, page = 1, perPage = 50) {
    return this.query().where('import_id', importId).paginate(page, perPage)
  }

  countInvalid(importId: string) {
    return this.query()
      .where('import_id', importId)
      .where('validation_status', 'invalid')
      .count('* as total')
  }
}

export default new SiopStagingRowRepository()
