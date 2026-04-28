import BaseRepository from '#shared/repositories/base_repository'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'

class PrecatorioRepository extends BaseRepository<typeof PrecatorioAsset> {
  constructor() {
    super(PrecatorioAsset)
  }

  listLatest(tenantId: string, page = 1, perPage = 25) {
    return this.query(tenantId).orderBy('created_at', 'desc').paginate(page, perPage)
  }

  findByExternalId(tenantId: string, externalId: string) {
    return this.query(tenantId).where('external_id', externalId).first()
  }
}

export default new PrecatorioRepository()
