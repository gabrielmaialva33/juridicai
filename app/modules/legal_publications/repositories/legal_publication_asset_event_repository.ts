import AssetEvent from '#modules/precatorios/models/asset_event'
import type { JsonRecord } from '#shared/types/model_enums'

class LegalPublicationAssetEventRepository {
  findProjectedLegalPublicationEvent(
    tenantId: string,
    input: {
      assetId: string
      idempotencyKey: string
    }
  ) {
    return AssetEvent.query()
      .where('tenant_id', tenantId)
      .where('asset_id', input.assetId)
      .where('event_type', 'legal_publication_detected')
      .where('idempotency_key', input.idempotencyKey)
      .first()
  }

  createLegalPublicationDetected(
    tenantId: string,
    input: {
      assetId: string
      idempotencyKey: string
      payload: JsonRecord
    }
  ) {
    return AssetEvent.create({
      tenantId,
      assetId: input.assetId,
      eventType: 'legal_publication_detected',
      source: 'djen',
      idempotencyKey: input.idempotencyKey,
      payload: input.payload,
    })
  }
}

export default new LegalPublicationAssetEventRepository()
