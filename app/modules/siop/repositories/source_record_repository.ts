import BaseRepository from '#shared/repositories/base_repository'
import SourceRecord from '#modules/siop/models/source_record'
import db from '@adonisjs/lucid/services/db'
import type { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { JsonRecord, SourceType } from '#shared/types/model_enums'

class SourceRecordRepository extends BaseRepository<typeof SourceRecord> {
  constructor() {
    super(SourceRecord)
  }

  findByChecksum(
    tenantId: string,
    checksum: string,
    source?: SourceType | null,
    trx?: TransactionClientContract
  ) {
    const query = this.queryWithClient(tenantId, trx).where('source_checksum', checksum)

    if (source) {
      query.where('source', source)
    }

    return query.first()
  }

  findAnyByIdOrFail(id: string, trx?: TransactionClientContract) {
    return this.model.query(clientOptions(trx)).where('id', id).firstOrFail()
  }

  async upsertByChecksum(
    tenantId: string,
    input: {
      source: SourceType
      sourceChecksum: string
      sourceDatasetId?: string | null
      sourceUrl?: string | null
      sourceFilePath?: string | null
      originalFilename?: string | null
      mimeType?: string | null
      fileSizeBytes?: bigint | number | null
      collectedAt?: DateTime
      rawData?: JsonRecord | null
    },
    trx?: TransactionClientContract
  ) {
    const existing = await this.findByChecksum(tenantId, input.sourceChecksum, input.source, trx)

    if (existing) {
      existing.merge({
        sourceDatasetId: input.sourceDatasetId ?? null,
        sourceUrl: input.sourceUrl ?? null,
        sourceFilePath: input.sourceFilePath ?? existing.sourceFilePath,
        originalFilename: input.originalFilename ?? existing.originalFilename,
        mimeType: input.mimeType ?? existing.mimeType,
        fileSizeBytes: input.fileSizeBytes ?? existing.fileSizeBytes,
        collectedAt: input.collectedAt ?? existing.collectedAt,
        rawData: input.rawData ?? null,
      })
      await existing.save()
      existing.$extras.created = false
      return existing
    }

    const sourceRecord = await SourceRecord.create(
      {
        tenantId,
        sourceDatasetId: input.sourceDatasetId ?? null,
        source: input.source,
        sourceUrl: input.sourceUrl ?? null,
        sourceFilePath: input.sourceFilePath ?? null,
        sourceChecksum: input.sourceChecksum,
        originalFilename: input.originalFilename ?? null,
        mimeType: input.mimeType ?? null,
        fileSizeBytes: input.fileSizeBytes ?? null,
        collectedAt: input.collectedAt,
        rawData: input.rawData ?? null,
      },
      clientOptions(trx)
    )
    sourceRecord.$extras.created = true
    return sourceRecord
  }

  countsByDataset(tenantId: string) {
    return db
      .from('source_records')
      .select('source_dataset_id')
      .count('* as records_count')
      .max('collected_at as last_collected_at')
      .where('tenant_id', tenantId)
      .whereNotNull('source_dataset_id')
      .groupBy('source_dataset_id')
  }

  private queryWithClient(tenantId: string, trx?: TransactionClientContract) {
    return this.model.query(clientOptions(trx)).where('tenant_id', tenantId)
  }
}

function clientOptions(trx?: TransactionClientContract) {
  return trx ? { client: trx } : undefined
}

export default new SourceRecordRepository()
