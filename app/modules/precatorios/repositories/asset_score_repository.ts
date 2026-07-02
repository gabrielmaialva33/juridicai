import BaseRepository from '#shared/repositories/base_repository'
import AssetScore from '#modules/precatorios/models/asset_score'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { JsonRecord } from '#shared/types/model_enums'

class AssetScoreRepository extends BaseRepository<typeof AssetScore> {
  constructor() {
    super(AssetScore)
  }

  listByAsset(tenantId: string, assetId: string) {
    return this.query(tenantId).where('asset_id', assetId).orderBy('computed_at', 'desc')
  }

  latestByVersion(tenantId: string, assetId: string, scoreVersion: string) {
    return this.query(tenantId)
      .where('asset_id', assetId)
      .where('score_version', scoreVersion)
      .orderBy('computed_at', 'desc')
      .first()
  }

  createSiopScore(
    tenantId: string,
    input: {
      assetId: string
      dataQualityScore: number
      maturityScore: number | null
      finalScore: number
      explanation: JsonRecord
    },
    trx: TransactionClientContract
  ) {
    return AssetScore.create(
      {
        tenantId,
        assetId: input.assetId,
        scoreVersion: 'siop-v1',
        dataQualityScore: input.dataQualityScore,
        maturityScore: input.maturityScore,
        liquidityScore: null,
        legalSignalScore: null,
        economicScore: null,
        riskScore: null,
        finalScore: input.finalScore,
        explanation: input.explanation,
      },
      { client: trx }
    )
  }
}

export default new AssetScoreRepository()
