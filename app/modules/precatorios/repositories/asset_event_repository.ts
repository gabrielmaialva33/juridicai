import BaseRepository from '#shared/repositories/base_repository'
import AssetEvent from '#modules/precatorios/models/asset_event'
import type { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { JsonRecord, SourceType } from '#shared/types/model_enums'

class AssetEventRepository extends BaseRepository<typeof AssetEvent> {
  constructor() {
    super(AssetEvent)
  }

  listByAsset(tenantId: string, assetId: string) {
    return this.query(tenantId).where('asset_id', assetId).orderBy('event_date', 'desc')
  }

  upsertEvent(
    tenantId: string,
    input: {
      assetId: string
      eventType: string
      eventDate: DateTime
      source: SourceType | null
      payload: JsonRecord | null
      idempotencyKey: string
    },
    trx?: TransactionClientContract
  ) {
    const queryClient = clientOptions(trx)
    return AssetEvent.updateOrCreate(
      {
        tenantId,
        assetId: input.assetId,
        eventType: input.eventType,
        idempotencyKey: input.idempotencyKey,
      },
      {
        tenantId,
        assetId: input.assetId,
        eventType: input.eventType,
        eventDate: input.eventDate,
        source: input.source,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey,
      },
      queryClient
    )
  }

  createSiopImported(
    tenantId: string,
    input: {
      assetId: string
      idempotencyKey: string
      eventDate: DateTime
      payload: JsonRecord
    },
    trx: TransactionClientContract
  ) {
    return this.upsertEvent(
      tenantId,
      {
        assetId: input.assetId,
        eventType: 'siop_imported',
        eventDate: input.eventDate,
        source: 'siop',
        payload: input.payload,
        idempotencyKey: input.idempotencyKey,
      },
      trx
    )
  }
}

function clientOptions(trx?: TransactionClientContract) {
  return trx ? { client: trx } : undefined
}

export default new AssetEventRepository()
