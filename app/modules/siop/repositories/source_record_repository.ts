import BaseRepository from '#shared/repositories/base_repository'
import SourceRecord from '#modules/siop/models/source_record'

class SourceRecordRepository extends BaseRepository<typeof SourceRecord> {
  constructor() {
    super(SourceRecord)
  }

  findByChecksum(tenantId: string, checksum: string) {
    return this.query(tenantId).where('source_checksum', checksum).first()
  }
}

export default new SourceRecordRepository()
