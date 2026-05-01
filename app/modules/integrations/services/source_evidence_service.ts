import { DateTime } from 'luxon'
import AssetSourceLink from '#modules/precatorios/models/asset_source_link'
import ExternalIdentifier from '#modules/precatorios/models/external_identifier'
import SourceDataset from '#modules/integrations/models/source_dataset'
import type {
  AssetSourceLinkType,
  ExternalIdentifierType,
  JsonRecord,
} from '#shared/types/model_enums'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

type LinkAssetInput = {
  tenantId: string
  assetId: string
  sourceRecordId: string
  sourceDatasetKey?: string | null
  linkType: AssetSourceLinkType
  confidence?: number
  matchReason?: string | null
  matchedFields?: JsonRecord | null
  normalizedPayload?: JsonRecord | null
  rawPointer?: JsonRecord | null
  trx?: TransactionClientContract
}

type UpsertIdentifierInput = {
  tenantId: string
  assetId: string
  sourceRecordId?: string | null
  sourceDatasetKey?: string | null
  identifierType: ExternalIdentifierType
  identifierValue: string | number | null | undefined
  issuer?: string | null
  confidence?: number
  isPrimary?: boolean
  rawData?: JsonRecord | null
  trx?: TransactionClientContract
}

class SourceEvidenceService {
  async datasetIdByKey(key: string | null | undefined, trx?: TransactionClientContract) {
    if (!key) {
      return null
    }

    const query = trx ? SourceDataset.query({ client: trx }) : SourceDataset.query()
    const dataset = await query.where('key', key).first()
    return dataset?.id ?? null
  }

  async linkAsset(input: LinkAssetInput) {
    const sourceDatasetId = await this.datasetIdByKey(input.sourceDatasetKey, input.trx)
    const query = input.trx ? AssetSourceLink.query({ client: input.trx }) : AssetSourceLink.query()
    const existing = await query
      .where('tenant_id', input.tenantId)
      .where('asset_id', input.assetId)
      .where('source_record_id', input.sourceRecordId)
      .first()
    const payload = {
      tenantId: input.tenantId,
      assetId: input.assetId,
      sourceRecordId: input.sourceRecordId,
      sourceDatasetId,
      linkType: input.linkType,
      confidence: confidenceString(input.confidence ?? 1),
      matchReason: input.matchReason ?? null,
      matchedFields: input.matchedFields ?? null,
      normalizedPayload: input.normalizedPayload ?? null,
      rawPointer: input.rawPointer ?? null,
      lastSeenAt: DateTime.now(),
    }

    if (existing) {
      if (input.trx) {
        existing.useTransaction(input.trx)
      }
      existing.merge(payload)
      await existing.save()
      return existing
    }

    return AssetSourceLink.create(
      {
        ...payload,
        firstSeenAt: DateTime.now(),
      },
      clientOptions(input.trx)
    )
  }

  async upsertIdentifier(input: UpsertIdentifierInput) {
    const normalizedValue = normalizeIdentifier(input.identifierType, input.identifierValue)
    if (!normalizedValue) {
      return null
    }

    const sourceDatasetId = await this.datasetIdByKey(input.sourceDatasetKey, input.trx)
    const query = input.trx
      ? ExternalIdentifier.query({ client: input.trx })
      : ExternalIdentifier.query()
    const existing = await query
      .where('tenant_id', input.tenantId)
      .where('asset_id', input.assetId)
      .where('identifier_type', input.identifierType)
      .where('normalized_value', normalizedValue)
      .first()
    const payload = {
      tenantId: input.tenantId,
      assetId: input.assetId,
      sourceRecordId: input.sourceRecordId ?? null,
      sourceDatasetId,
      identifierType: input.identifierType,
      identifierValue: String(input.identifierValue ?? '').trim(),
      normalizedValue,
      issuer: input.issuer ?? null,
      confidence: confidenceString(input.confidence ?? 1),
      isPrimary: input.isPrimary ?? false,
      rawData: input.rawData ?? null,
    }

    if (existing) {
      if (input.trx) {
        existing.useTransaction(input.trx)
      }
      existing.merge(payload)
      await existing.save()
      return existing
    }

    return ExternalIdentifier.create(payload, clientOptions(input.trx))
  }
}

function clientOptions(trx?: TransactionClientContract) {
  return trx ? { client: trx } : undefined
}

function confidenceString(value: number) {
  return Math.max(0, Math.min(1, value)).toFixed(4)
}

function normalizeIdentifier(
  type: ExternalIdentifierType,
  value: string | number | null | undefined
) {
  const text = String(value ?? '').trim()
  if (!text) {
    return null
  }

  if (
    type === 'cnj_number' ||
    type === 'origin_process_number' ||
    type === 'precatorio_number' ||
    type === 'requisition_number'
  ) {
    return text.replace(/\D/g, '')
  }

  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

export default new SourceEvidenceService()
