import BaseRepository from '#shared/repositories/base_repository'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import type { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

class AssetValuationRepository extends BaseRepository<typeof AssetValuation> {
  constructor() {
    super(AssetValuation)
  }

  createForSiopImport(
    tenantId: string,
    input: {
      assetId: string
      faceValue: string | null
      estimatedUpdatedValue: string | null
      baseDate: DateTime | null
      correctionStartedAt: DateTime | null
      correctionEndedAt: DateTime | null
      correctionIndex: string | null
      sourceRecordId: string
      rawData: Record<string, unknown>
    },
    trx: TransactionClientContract
  ) {
    return AssetValuation.create({ tenantId, ...input }, { client: trx })
  }
}

export default new AssetValuationRepository()
