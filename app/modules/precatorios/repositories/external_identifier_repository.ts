import BaseRepository from '#shared/repositories/base_repository'
import ExternalIdentifier from '#modules/precatorios/models/external_identifier'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ExternalIdentifierType, JsonRecord } from '#shared/types/model_enums'

class ExternalIdentifierRepository extends BaseRepository<typeof ExternalIdentifier> {
  constructor() {
    super(ExternalIdentifier)
  }

  async upsertIdentifier(
    tenantId: string,
    input: {
      assetId: string
      sourceRecordId: string | null
      sourceDatasetId: string | null
      identifierType: ExternalIdentifierType
      identifierValue: string
      normalizedValue: string
      issuer: string | null
      confidence: string
      isPrimary: boolean
      rawData: JsonRecord | null
    },
    trx?: TransactionClientContract
  ) {
    const existing = await this.queryWithClient(tenantId, trx)
      .where('asset_id', input.assetId)
      .where('identifier_type', input.identifierType)
      .where('normalized_value', input.normalizedValue)
      .first()
    const payload = { tenantId, ...input }

    if (existing) {
      if (trx) existing.useTransaction(trx)
      existing.merge(payload)
      await existing.save()
      return existing
    }

    return ExternalIdentifier.create(payload, clientOptions(trx))
  }

  private queryWithClient(tenantId: string, trx?: TransactionClientContract) {
    return ExternalIdentifier.query(clientOptions(trx)).where('tenant_id', tenantId)
  }
}

function clientOptions(trx?: TransactionClientContract) {
  return trx ? { client: trx } : undefined
}

export default new ExternalIdentifierRepository()
