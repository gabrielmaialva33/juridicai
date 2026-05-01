import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import ProcessMatchCandidate from '#modules/integrations/models/process_match_candidate'
import AssetEvent from '#modules/precatorios/models/asset_event'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import type { JsonRecord } from '#shared/types/model_enums'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

const DEFAULT_MIN_ACCEPT_SCORE = 85

type DataJudCandidateReviewOptions = {
  tenantId?: string
  userId?: string | null
  requestId?: string | null
  force?: boolean
  minScore?: number
}

type DataJudCandidateReviewContext = Pick<
  DataJudCandidateReviewOptions,
  'tenantId' | 'userId' | 'requestId'
>

class DataJudCandidateReviewError extends Error {
  constructor(
    public code: 'candidate_not_acceptable' | 'invalid_decision',
    message: string
  ) {
    super(message)
  }
}

class DataJudCandidateReviewService {
  async accept(candidateId: string, options: DataJudCandidateReviewOptions = {}) {
    return db.transaction(async (trx) => {
      const candidate = await this.findCandidateForReview(candidateId, options.tenantId, trx)
      const minScore = options.minScore ?? DEFAULT_MIN_ACCEPT_SCORE

      if (!options.force && candidate.score < minScore) {
        throw new DataJudCandidateReviewError(
          'candidate_not_acceptable',
          `Candidate score ${candidate.score} is below the minimum ${minScore}.`
        )
      }

      const judicialProcess = await this.upsertJudicialProcess(candidate, trx)
      candidate.status = 'accepted'
      candidate.useTransaction(trx)
      await candidate.save()
      await this.createReviewEvent(candidate, 'datajud_candidate_accepted', trx, options)
      await this.writeAuditLog(candidate, 'datajud_candidate_accepted', trx, options)

      await ProcessMatchCandidate.query({ client: trx })
        .where('tenant_id', candidate.tenantId)
        .where('asset_id', candidate.assetId)
        .whereNot('id', candidate.id)
        .whereIn('status', ['candidate', 'ambiguous'])
        .update({ status: 'rejected', updated_at: new Date() })

      return { candidate, judicialProcess }
    })
  }

  async reject(candidateId: string, options: DataJudCandidateReviewContext = {}) {
    return db.transaction(async (trx) => {
      const candidate = await this.findCandidateForReview(candidateId, options.tenantId, trx)

      candidate.status = 'rejected'
      candidate.useTransaction(trx)
      await candidate.save()
      await this.createReviewEvent(candidate, 'datajud_candidate_rejected', trx, options)
      await this.writeAuditLog(candidate, 'datajud_candidate_rejected', trx, options)

      return candidate
    })
  }

  async markAmbiguous(candidateId: string, options: DataJudCandidateReviewContext = {}) {
    return db.transaction(async (trx) => {
      const candidate = await this.findCandidateForReview(candidateId, options.tenantId, trx)

      candidate.status = 'ambiguous'
      candidate.useTransaction(trx)
      await candidate.save()
      await this.createReviewEvent(candidate, 'datajud_candidate_marked_ambiguous', trx, options)
      await this.writeAuditLog(candidate, 'datajud_candidate_marked_ambiguous', trx, options)

      return candidate
    })
  }

  private findCandidateForReview(
    candidateId: string,
    tenantId: string | undefined,
    trx: TransactionClientContract
  ) {
    const query = ProcessMatchCandidate.query({ client: trx }).where('id', candidateId).forUpdate()

    if (tenantId) {
      query.where('tenant_id', tenantId)
    }

    return query.firstOrFail()
  }

  private async upsertJudicialProcess(
    candidate: ProcessMatchCandidate,
    trx: TransactionClientContract
  ) {
    const source = readRawSource(candidate.rawData)
    const existing = await JudicialProcess.query({ client: trx })
      .where('tenant_id', candidate.tenantId)
      .where('cnj_number', candidate.candidateCnj)
      .first()
    const payload = {
      tenantId: candidate.tenantId,
      assetId: candidate.assetId,
      sourceRecordId: null,
      source: 'datajud' as const,
      cnjNumber: candidate.candidateCnj,
      courtCode: stringOrNull(source.tribunal) ?? candidate.courtAlias.toUpperCase(),
      courtName: stringOrNull(readNested(source, ['orgaoJulgador', 'nome'])),
      className: stringOrNull(readNested(source, ['classe', 'nome'])),
      subject: firstSubject(source.assuntos),
      filedAt: parseDataJudDate(source.dataAjuizamento),
      rawData: {
        ...candidate.rawData,
        acceptedFromCandidateId: candidate.id,
        acceptedAt: DateTime.now().toISO(),
      },
    }

    if (existing) {
      existing.useTransaction(trx)
      existing.merge(payload)
      await existing.save()
      return existing
    }

    return JudicialProcess.create(payload, { client: trx })
  }

  private async createReviewEvent(
    candidate: ProcessMatchCandidate,
    eventType:
      | 'datajud_candidate_accepted'
      | 'datajud_candidate_rejected'
      | 'datajud_candidate_marked_ambiguous',
    trx: TransactionClientContract,
    context: DataJudCandidateReviewContext
  ) {
    const idempotencyKey = `${eventType}:${candidate.id}`
    const existing = await AssetEvent.query({ client: trx })
      .where('tenant_id', candidate.tenantId)
      .where('asset_id', candidate.assetId)
      .where('event_type', eventType)
      .where('idempotency_key', idempotencyKey)
      .first()

    if (existing) {
      return existing
    }

    return AssetEvent.create(
      {
        tenantId: candidate.tenantId,
        assetId: candidate.assetId,
        eventType,
        eventDate: DateTime.now(),
        source: 'datajud',
        payload: {
          candidateId: candidate.id,
          candidateCnj: candidate.candidateCnj,
          candidateDatajudId: candidate.candidateDatajudId,
          score: candidate.score,
          signals: candidate.signals,
          reviewedByUserId: context.userId ?? null,
          requestId: context.requestId ?? null,
          reviewedAt: DateTime.now().toISO(),
        },
        idempotencyKey,
      },
      { client: trx }
    )
  }

  private writeAuditLog(
    candidate: ProcessMatchCandidate,
    eventType:
      | 'datajud_candidate_accepted'
      | 'datajud_candidate_rejected'
      | 'datajud_candidate_marked_ambiguous',
    trx: TransactionClientContract,
    context: DataJudCandidateReviewContext
  ) {
    return trx.table('audit_logs').insert({
      tenant_id: candidate.tenantId,
      user_id: context.userId ?? null,
      event: eventType,
      entity_type: 'process_match_candidate',
      entity_id: candidate.id,
      metadata: {
        assetId: candidate.assetId,
        candidateCnj: candidate.candidateCnj,
        candidateDatajudId: candidate.candidateDatajudId,
        score: candidate.score,
        status: candidate.status,
      },
      request_id: context.requestId ?? null,
    })
  }
}

function readRawSource(rawData: JsonRecord) {
  const source = rawData.source
  return source && typeof source === 'object' && !Array.isArray(source)
    ? (source as JsonRecord)
    : {}
}

function readNested(record: JsonRecord, path: string[]) {
  let current: unknown = record

  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return null
    }

    current = (current as JsonRecord)[key]
  }

  return current
}

function stringOrNull(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function firstSubject(value: unknown) {
  if (!Array.isArray(value)) {
    return null
  }

  const subject = value
    .flat(2)
    .find((item): item is JsonRecord => !!item && typeof item === 'object' && !Array.isArray(item))

  return stringOrNull(subject?.nome)
}

function parseDataJudDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const trimmed = value.trim()
  const parsed = /^\d{14}$/.test(trimmed)
    ? DateTime.fromFormat(trimmed, 'yyyyLLddHHmmss')
    : /^\d{8}$/.test(trimmed)
      ? DateTime.fromFormat(trimmed, 'yyyyLLdd')
      : DateTime.fromISO(trimmed)

  return parsed.isValid ? parsed.startOf('day') : null
}

export { DataJudCandidateReviewError }
export default new DataJudCandidateReviewService()
