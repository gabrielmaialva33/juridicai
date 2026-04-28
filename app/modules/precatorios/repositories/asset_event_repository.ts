import BaseRepository from '#shared/repositories/base_repository'
import AssetEvent from '#modules/precatorios/models/asset_event'

class AssetEventRepository extends BaseRepository<typeof AssetEvent> {
  constructor() {
    super(AssetEvent)
  }

  listByAsset(tenantId: string, assetId: string) {
    return this.query(tenantId).where('asset_id', assetId).orderBy('event_date', 'desc')
  }
}

export default new AssetEventRepository()
