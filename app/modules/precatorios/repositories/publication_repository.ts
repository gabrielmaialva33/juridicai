import BaseRepository from '#shared/repositories/base_repository'
import Publication from '#modules/precatorios/models/publication'

class PublicationRepository extends BaseRepository<typeof Publication> {
  constructor() {
    super(Publication)
  }

  listByAsset(tenantId: string, assetId: string) {
    return this.query(tenantId).where('asset_id', assetId).orderBy('publication_date', 'desc')
  }
}

export default new PublicationRepository()
