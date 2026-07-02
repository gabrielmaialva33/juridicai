import BaseRepository from '#shared/repositories/base_repository'
import SiopImport from '#modules/siop/models/siop_import'
import type { ImportStatus, JsonRecord } from '#shared/types/model_enums'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

class SiopImportRepository extends BaseRepository<typeof SiopImport> {
  constructor() {
    super(SiopImport)
  }

  listRecent(tenantId: string, limit = 25) {
    return this.query(tenantId).orderBy('created_at', 'desc').limit(limit)
  }

  findBySourceRecord(tenantId: string, sourceRecordId: string) {
    return this.query(tenantId).where('source_record_id', sourceRecordId).first()
  }

  findByIdWithSourceRecord(tenantId: string, id: string) {
    return this.query(tenantId).where('id', id).preload('sourceRecord').firstOrFail()
  }

  findAnyByIdWithSourceRecord(id: string) {
    return SiopImport.query().where('id', id).preload('sourceRecord').firstOrFail()
  }

  findOpenDataImport(tenantId: string, exerciseYear: number, sourceRecordId: string) {
    return this.query(tenantId)
      .where('source', 'siop')
      .where('exercise_year', exerciseYear)
      .where('source_record_id', sourceRecordId)
      .first()
  }

  async findOrCreatePendingOpenDataImport(
    tenantId: string,
    input: {
      exerciseYear: number
      sourceRecordId: string
      metadata: JsonRecord
    }
  ) {
    const existing = await this.query(tenantId)
      .where('source', 'siop')
      .where('exercise_year', input.exerciseYear)
      .where('source_record_id', input.sourceRecordId)
      .first()

    if (existing) {
      return { siopImport: existing, created: false }
    }

    const siopImport = await this.create(tenantId, {
      exerciseYear: input.exerciseYear,
      sourceRecordId: input.sourceRecordId,
      source: 'siop',
      status: 'pending',
      totalRows: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      rawMetadata: input.metadata,
      uploadedByUserId: null,
    })

    return { siopImport, created: true }
  }

  createPendingImport(
    tenantId: string,
    input: {
      exerciseYear: number
      sourceRecordId: string
      metadata?: JsonRecord | null
      uploadedByUserId?: string | null
    }
  ) {
    return this.create(tenantId, {
      exerciseYear: input.exerciseYear,
      sourceRecordId: input.sourceRecordId,
      source: 'siop',
      status: 'pending',
      totalRows: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      rawMetadata: input.metadata ?? null,
      uploadedByUserId: input.uploadedByUserId ?? null,
    })
  }

  findForStart(id: string, trx: TransactionClientContract) {
    return SiopImport.query({ client: trx }).where('id', id).forUpdate().firstOrFail()
  }

  async markRunning(siopImport: SiopImport, trx: TransactionClientContract) {
    siopImport.merge({
      status: 'running' as ImportStatus,
      startedAt: DateTime.now(),
      finishedAt: null,
      totalRows: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    })
    siopImport.useTransaction(trx)
    await siopImport.save()
    return siopImport
  }
}

export default new SiopImportRepository()
