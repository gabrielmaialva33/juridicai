import BaseRepository from '#shared/repositories/base_repository'
import AssetSourceLink from '#modules/precatorios/models/asset_source_link'
import type { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { AssetSourceLinkType, JsonRecord } from '#shared/types/model_enums'

class AssetSourceLinkRepository extends BaseRepository<typeof AssetSourceLink> {
  constructor() {
    super(AssetSourceLink)
  }

  async upsertLink(
    tenantId: string,
    input: {
      assetId: string
      sourceRecordId: string
      sourceDatasetId: string | null
      linkType: AssetSourceLinkType
      confidence: string
      matchReason: string | null
      matchedFields: JsonRecord | null
      normalizedPayload: JsonRecord | null
      rawPointer: JsonRecord | null
      firstSeenAt: DateTime
      lastSeenAt: DateTime
    },
    trx?: TransactionClientContract
  ) {
    const existing = await this.queryWithClient(tenantId, trx)
      .where('asset_id', input.assetId)
      .where('source_record_id', input.sourceRecordId)
      .first()
    const payload = {
      tenantId,
      assetId: input.assetId,
      sourceRecordId: input.sourceRecordId,
      sourceDatasetId: input.sourceDatasetId,
      linkType: input.linkType,
      confidence: input.confidence,
      matchReason: input.matchReason,
      matchedFields: input.matchedFields,
      normalizedPayload: input.normalizedPayload,
      rawPointer: input.rawPointer,
      lastSeenAt: input.lastSeenAt,
    }

    if (existing) {
      if (trx) existing.useTransaction(trx)
      existing.merge(payload)
      await existing.save()
      return existing
    }

    return AssetSourceLink.create(
      { ...payload, firstSeenAt: input.firstSeenAt },
      clientOptions(trx)
    )
  }

  private queryWithClient(tenantId: string, trx?: TransactionClientContract) {
    return AssetSourceLink.query(clientOptions(trx)).where('tenant_id', tenantId)
  }
}

function clientOptions(trx?: TransactionClientContract) {
  return trx ? { client: trx } : undefined
}

export default new AssetSourceLinkRepository()
