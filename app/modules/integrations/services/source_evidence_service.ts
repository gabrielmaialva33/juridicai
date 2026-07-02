import { DateTime } from 'luxon'
import sourceDatasetRepository from '#modules/integrations/repositories/source_dataset_repository'
import assetSourceLinkRepository from '#modules/precatorios/repositories/asset_source_link_repository'
import externalIdentifierRepository from '#modules/precatorios/repositories/external_identifier_repository'
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

    return sourceDatasetRepository.findIdByKey(key, trx)
  }

  async linkAsset(input: LinkAssetInput) {
    const sourceDatasetId = await this.datasetIdByKey(input.sourceDatasetKey, input.trx)
    return assetSourceLinkRepository.upsertLink(
      input.tenantId,
      {
        assetId: input.assetId,
        sourceRecordId: input.sourceRecordId,
        sourceDatasetId,
        linkType: input.linkType,
        confidence: confidenceString(input.confidence ?? 1),
        matchReason: input.matchReason ?? null,
        matchedFields: input.matchedFields ?? null,
        normalizedPayload: input.normalizedPayload ?? null,
        rawPointer: input.rawPointer ?? null,
        firstSeenAt: DateTime.now(),
        lastSeenAt: DateTime.now(),
      },
      input.trx
    )
  }

  async upsertIdentifier(input: UpsertIdentifierInput) {
    const normalizedValue = normalizeIdentifier(input.identifierType, input.identifierValue)
    if (!normalizedValue) {
      return null
    }

    const sourceDatasetId = await this.datasetIdByKey(input.sourceDatasetKey, input.trx)
    return externalIdentifierRepository.upsertIdentifier(
      input.tenantId,
      {
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
      },
      input.trx
    )
  }
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
