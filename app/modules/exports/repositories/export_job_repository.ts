import BaseRepository from '#shared/repositories/base_repository'
import ExportJob from '#modules/exports/models/export_job'

class ExportJobRepository extends BaseRepository<typeof ExportJob> {
  constructor() {
    super(ExportJob)
  }

  listRecent(tenantId: string, limit = 25) {
    return this.query(tenantId).orderBy('created_at', 'desc').limit(limit)
  }

  createPendingPrecatoriosCsv(
    tenantId: string,
    input: {
      requestedByUserId: string
      filters: Record<string, unknown>
    }
  ) {
    return this.create(tenantId, {
      requestedByUserId: input.requestedByUserId,
      status: 'pending',
      exportType: 'precatorios_csv',
      filters: input.filters,
    })
  }

  async markFailed(exportJob: ExportJob, errorMessage: string) {
    exportJob.merge({
      status: 'failed',
      errorMessage,
    })
    await exportJob.save()
    return exportJob
  }
}

export default new ExportJobRepository()
