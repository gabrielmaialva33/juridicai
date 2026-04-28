import BaseRepository from '#shared/repositories/base_repository'
import ExportJob from '#modules/exports/models/export_job'

class ExportJobRepository extends BaseRepository<typeof ExportJob> {
  constructor() {
    super(ExportJob)
  }

  listRecent(tenantId: string, limit = 25) {
    return this.query(tenantId).orderBy('created_at', 'desc').limit(limit)
  }
}

export default new ExportJobRepository()
