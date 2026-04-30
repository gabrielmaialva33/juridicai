import BaseRepository from '#shared/repositories/base_repository'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'

class PrecatorioRepository extends BaseRepository<typeof PrecatorioAsset> {
  constructor() {
    super(PrecatorioAsset)
  }

  listLatest(tenantId: string, page = 1, perPage = 25) {
    return this.query(tenantId).orderBy('created_at', 'desc').paginate(page, perPage)
  }

  showWithDetails(tenantId: string, id: string) {
    return this.query(tenantId)
      .where('id', id)
      .preload('debtor')
      .preload('sourceRecord')
      .preload('currentScoreRow')
      .preload('events', (query) => query.orderBy('event_date', 'desc').limit(50))
      .preload('scores', (query) => query.orderBy('created_at', 'desc').limit(20))
      .preload('judicialProcesses', (query) => query.orderBy('created_at', 'desc').limit(20))
      .preload('publications', (query) => query.orderBy('published_at', 'desc').limit(20))
      .firstOrFail()
  }

  findByExternalId(tenantId: string, externalId: string) {
    return this.query(tenantId).where('external_id', externalId).first()
  }
}

export default new PrecatorioRepository()
