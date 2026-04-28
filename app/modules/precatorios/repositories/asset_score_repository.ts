import BaseRepository from '#shared/repositories/base_repository'
import AssetScore from '#modules/precatorios/models/asset_score'

class AssetScoreRepository extends BaseRepository<typeof AssetScore> {
  constructor() {
    super(AssetScore)
  }

  listByAsset(tenantId: string, assetId: string) {
    return this.query(tenantId).where('asset_id', assetId).orderBy('computed_at', 'desc')
  }
}

export default new AssetScoreRepository()
