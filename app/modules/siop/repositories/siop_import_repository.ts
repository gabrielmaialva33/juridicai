import BaseRepository from '#shared/repositories/base_repository'
import SiopImport from '#modules/siop/models/siop_import'

class SiopImportRepository extends BaseRepository<typeof SiopImport> {
  constructor() {
    super(SiopImport)
  }

  listRecent(tenantId: string, limit = 25) {
    return this.query(tenantId).orderBy('created_at', 'desc').limit(limit)
  }

  findBySourceRecord(tenantId: string, sourceRecordId: string) {
    return this.query(tenantId).where('source_record_id', sourceRecordId).first()
  }
}

export default new SiopImportRepository()
