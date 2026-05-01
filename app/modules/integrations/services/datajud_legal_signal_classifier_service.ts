import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import AssetEvent from '#modules/precatorios/models/asset_event'
import JudicialProcessMovement from '#modules/precatorios/models/judicial_process_movement'
import JudicialProcessSignal, {
  type JudicialSignalPolarity,
} from '#modules/precatorios/models/judicial_process_signal'
import assetSignalScoreService from '#modules/precatorios/services/asset_signal_score_service'
import { classifyLegalSignalText } from '#modules/integrations/services/legal_signal_rules'
import type { JsonRecord } from '#shared/types/model_enums'

export type DataJudLegalSignalClassifierOptions = {
  tenantId: string
  limit?: number | null
  processId?: string | null
  projectAssetEvents?: boolean
}

export type DataJudLegalSignalClassifierMetrics = {
  selectedMovements: number
  matchedSignals: number
  processSignalsUpserted: number
  assetEventsUpserted: number
  assetScoresRefreshed: number
  assetScoresCreated: number
}

const DEFAULT_LIMIT = 1_000
const MAX_LIMIT = 10_000

class DataJudLegalSignalClassifierService {
  async classify(
    options: DataJudLegalSignalClassifierOptions
  ): Promise<DataJudLegalSignalClassifierMetrics> {
    const movements = await this.selectMovements(options)
    const metrics: DataJudLegalSignalClassifierMetrics = {
      selectedMovements: movements.length,
      matchedSignals: 0,
      processSignalsUpserted: 0,
      assetEventsUpserted: 0,
      assetScoresRefreshed: 0,
      assetScoresCreated: 0,
    }
    const affectedAssetIds = new Set<string>()

    for (const movement of movements) {
      const matches = classifyMovement(movement)
      metrics.matchedSignals += matches.length

      for (const match of matches) {
        const signal = await this.upsertProcessSignal(options.tenantId, movement, match)
        metrics.processSignalsUpserted += 1

        if (options.projectAssetEvents !== false && movement.process.assetId) {
          await this.upsertAssetEvent(movement.process.assetId, signal)
          metrics.assetEventsUpserted += 1
          affectedAssetIds.add(movement.process.assetId)
        }
      }
    }

    for (const assetId of affectedAssetIds) {
      const result = await assetSignalScoreService.refresh(options.tenantId, assetId)
      metrics.assetScoresRefreshed += 1
      if (result.created) {
        metrics.assetScoresCreated += 1
      }
    }

    return metrics
  }

  private selectMovements(options: DataJudLegalSignalClassifierOptions) {
    const query = JudicialProcessMovement.query()
      .where('tenant_id', options.tenantId)
      .preload('process')
      .preload('complements')
      .orderBy('occurred_at', 'desc')
      .orderBy('created_at', 'desc')
      .limit(normalizeLimit(options.limit))

    if (options.processId) {
      query.where('process_id', options.processId)
    }

    return query
  }

  private async upsertProcessSignal(
    tenantId: string,
    movement: JudicialProcessMovement,
    match: ClassifiedSignal
  ) {
    const idempotencyKey = buildSignalIdempotencyKey(movement, match.code)

    return JudicialProcessSignal.updateOrCreate(
      {
        tenantId,
        idempotencyKey,
      },
      {
        tenantId,
        processId: movement.processId,
        movementId: movement.id,
        signalCode: match.code,
        polarity: match.polarity,
        confidence: match.confidence,
        detectedAt: movement.occurredAt ?? DateTime.utc(),
        source: 'datajud',
        evidence: match.evidence,
        idempotencyKey,
      }
    )
  }

  private async upsertAssetEvent(assetId: string, signal: JudicialProcessSignal) {
    const idempotencyKey = `datajud-signal:${signal.idempotencyKey}`

    return AssetEvent.updateOrCreate(
      {
        tenantId: signal.tenantId,
        assetId,
        eventType: signal.signalCode,
        idempotencyKey,
      },
      {
        tenantId: signal.tenantId,
        assetId,
        eventType: signal.signalCode,
        eventDate: signal.detectedAt,
        source: 'datajud',
        payload: {
          processSignalId: signal.id,
          processId: signal.processId,
          movementId: signal.movementId,
          polarity: signal.polarity,
          confidence: signal.confidence,
          evidence: signal.evidence,
        },
        idempotencyKey,
      }
    )
  }
}

type ClassifiedSignal = {
  code: string
  polarity: JudicialSignalPolarity
  confidence: number
  evidence: JsonRecord
}

function classifyMovement(movement: JudicialProcessMovement): ClassifiedSignal[] {
  return classifyLegalSignalText({
    text: buildSearchableText(movement),
    movementCode: movement.movementCode,
  }).map((match) => ({
    code: match.code,
    polarity: match.polarity,
    confidence: match.confidence,
    evidence: {
      movementId: movement.id,
      movementCode: movement.movementCode,
      movementName: movement.movementName,
      occurredAt: movement.occurredAt?.toISO() ?? null,
      judgingBodyName: movement.judgingBodyName,
      complements: movement.complements.map((complement) => ({
        code: complement.complementCode,
        value: complement.complementValue,
        name: complement.complementName,
        description: complement.complementDescription,
      })),
      matchedBy: match.matchedBy,
    },
  }))
}

function buildSearchableText(movement: JudicialProcessMovement) {
  const complementText = movement.complements
    .map((complement) =>
      [
        complement.complementName,
        complement.complementDescription,
        complement.complementCode,
        complement.complementValue,
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(' ')
    )
    .join(' ')

  return [
    movement.movementName,
    movement.rawData ? JSON.stringify(movement.rawData) : '',
    complementText,
  ].join(' ')
}

function buildSignalIdempotencyKey(movement: JudicialProcessMovement, signalCode: string) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        source: 'datajud',
        processId: movement.processId,
        movementId: movement.id,
        signalCode,
      })
    )
    .digest('hex')
}

function normalizeLimit(value?: number | null) {
  if (!value || value < 1) {
    return DEFAULT_LIMIT
  }

  return Math.min(Math.floor(value), MAX_LIMIT)
}

export const dataJudLegalSignalClassifierService = new DataJudLegalSignalClassifierService()
export default dataJudLegalSignalClassifierService
