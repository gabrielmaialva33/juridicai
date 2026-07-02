import BaseRepository from '#shared/repositories/base_repository'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { DateTime } from 'luxon'
import type { JsonRecord, SourceType } from '#shared/types/model_enums'

class JudicialProcessRepository extends BaseRepository<typeof JudicialProcess> {
  constructor() {
    super(JudicialProcess)
  }

  findByCnj(tenantId: string, cnjNumber: string, trx?: TransactionClientContract) {
    return this.queryWithClient(tenantId, trx).where('cnj_number', cnjNumber).first()
  }

  listUnlinkedDataJud(tenantId: string, limit: number) {
    return this.query(tenantId)
      .where('source', 'datajud')
      .whereNull('asset_id')
      .whereNotNull('cnj_number')
      .orderBy('created_at', 'asc')
      .limit(limit)
  }

  async setAsset(process: JudicialProcess, assetId: string) {
    process.assetId = assetId
    await process.save()
    return process
  }

  async upsertDataJudAccepted(
    tenantId: string,
    input: {
      assetId: string
      cnjNumber: string
      courtId: string | null
      classId: string | null
      courtAlias: string | null
      filedAt: DateTime | null
      rawData: JsonRecord
    },
    trx?: TransactionClientContract
  ) {
    const existing = await this.findByCnj(tenantId, input.cnjNumber, trx)
    const payload = {
      tenantId,
      assetId: input.assetId,
      sourceRecordId: null,
      source: 'datajud' as SourceType,
      cnjNumber: input.cnjNumber,
      courtId: input.courtId,
      classId: input.classId,
      courtAlias: input.courtAlias,
      filedAt: input.filedAt,
      rawData: input.rawData,
    }

    if (existing) {
      if (trx) {
        existing.useTransaction(trx)
      }
      existing.merge(payload)
      await existing.save()
      return existing
    }

    return JudicialProcess.create(payload, clientOptions(trx))
  }

  private queryWithClient(tenantId: string, trx?: TransactionClientContract) {
    return JudicialProcess.query(clientOptions(trx))
      .where('tenant_id', tenantId)
      .whereNull('deleted_at')
  }
}

function clientOptions(trx?: TransactionClientContract) {
  return trx ? { client: trx } : undefined
}

export default new JudicialProcessRepository()
