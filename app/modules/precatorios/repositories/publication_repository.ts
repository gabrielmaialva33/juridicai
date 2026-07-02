import BaseRepository from '#shared/repositories/base_repository'
import Publication from '#modules/precatorios/models/publication'

class PublicationRepository extends BaseRepository<typeof Publication> {
  constructor() {
    super(Publication)
  }

  listByAsset(tenantId: string, assetId: string) {
    return this.query(tenantId).where('asset_id', assetId).orderBy('publication_date', 'desc')
  }

  listForSignalClassification(
    tenantId: string,
    options: {
      limit: number
      publicationId?: string | null
    }
  ) {
    const query = this.query(tenantId)
      .preload('process')
      .orderBy('publication_date', 'desc')
      .orderBy('created_at', 'desc')
      .limit(options.limit)

    if (options.publicationId) {
      query.where('id', options.publicationId)
    }

    return query
  }
}

export default new PublicationRepository()
