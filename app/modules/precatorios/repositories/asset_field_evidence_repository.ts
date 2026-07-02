import BaseRepository from '#shared/repositories/base_repository'
import AssetFieldEvidence, {
  type AssetFieldEvidenceStatus,
} from '#modules/precatorios/models/asset_field_evidence'
import type { DateTime } from 'luxon'
import type { JsonRecord, SourceType } from '#shared/types/model_enums'

class AssetFieldEvidenceRepository extends BaseRepository<typeof AssetFieldEvidence> {
  constructor() {
    super(AssetFieldEvidence)
  }

  upsertResolvedField(
    tenantId: string,
    input: {
      assetId: string
      fieldKey: string
      canonicalValue: string | null
      canonicalSource: SourceType | null
      canonicalSourceRecordId: string | null
      canonicalSourceDatasetId: string | null
      confidence: number
      status: AssetFieldEvidenceStatus
      evidenceCount: number
      conflictingValues: JsonRecord[]
      evidence: JsonRecord[]
      computedAt: DateTime
    }
  ) {
    return AssetFieldEvidence.updateOrCreate(
      {
        tenantId,
        assetId: input.assetId,
        fieldKey: input.fieldKey,
      },
      {
        tenantId,
        assetId: input.assetId,
        fieldKey: input.fieldKey,
        canonicalValue: input.canonicalValue,
        canonicalSource: input.canonicalSource,
        canonicalSourceRecordId: input.canonicalSourceRecordId,
        canonicalSourceDatasetId: input.canonicalSourceDatasetId,
        confidence: input.confidence.toFixed(4),
        status: input.status,
        evidenceCount: input.evidenceCount,
        conflictingValues: input.conflictingValues,
        evidence: input.evidence,
        computedAt: input.computedAt,
      }
    )
  }
}

export default new AssetFieldEvidenceRepository()
