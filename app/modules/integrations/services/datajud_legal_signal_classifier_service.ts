import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import AssetEvent from '#modules/precatorios/models/asset_event'
import JudicialProcessMovement from '#modules/precatorios/models/judicial_process_movement'
import JudicialProcessSignal, {
  type JudicialSignalPolarity,
} from '#modules/precatorios/models/judicial_process_signal'
import assetSignalScoreService from '#modules/precatorios/services/asset_signal_score_service'
import type { JsonRecord } from '#shared/types/model_enums'

type SignalRule = {
  code: string
  polarity: JudicialSignalPolarity
  confidence: number
  movementCodes?: number[]
  patterns: RegExp[]
}

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

const SIGNAL_RULES: SignalRule[] = [
  {
    code: 'requisition_issued',
    polarity: 'positive',
    confidence: 96,
    movementCodes: [12457],
    patterns: [/expedi[cç][aã]o\s+de\s+precat[oó]rio/i, /expedi[cç][aã]o\s+de\s+rpv/i],
  },
  {
    code: 'payment_available',
    polarity: 'positive',
    confidence: 94,
    patterns: [
      /pagamento\s+(disponibilizado|liberado|efetuado|realizado)/i,
      /dep[oó]sito\s+(disponibilizado|liberado|judicial)/i,
      /alvar[aá]\s+(expedido|liberado)/i,
    ],
  },
  {
    code: 'final_judgment',
    polarity: 'positive',
    confidence: 92,
    patterns: [/tr[aâ]nsito\s+em\s+julgado/i, /certid[aã]o\s+de\s+tr[aâ]nsito/i],
  },
  {
    code: 'calculation_homologated',
    polarity: 'positive',
    confidence: 90,
    patterns: [/c[aá]lculo.*homologad/i, /homologa[cç][aã]o.*c[aá]lculo/i],
  },
  {
    code: 'superpreference_granted',
    polarity: 'positive',
    confidence: 88,
    patterns: [/superprefer[eê]ncia/i, /prefer[eê]ncia.*idos/i, /doen[cç]a\s+grave/i],
  },
  {
    code: 'direct_agreement_opened',
    polarity: 'positive',
    confidence: 86,
    patterns: [/acordo\s+direto/i, /edital.*acordo/i, /concili[aá]rio.*precat[oó]rio/i],
  },
  {
    code: 'prior_cession_detected',
    polarity: 'negative',
    confidence: 94,
    patterns: [/cess[aã]o\s+de\s+cr[eé]dito/i, /cession[aá]rio/i, /cedente/i],
  },
  {
    code: 'lien_detected',
    polarity: 'negative',
    confidence: 90,
    patterns: [/penhora/i, /bloqueio/i, /constri[cç][aã]o/i, /indisponibilidade/i],
  },
  {
    code: 'suspension_detected',
    polarity: 'negative',
    confidence: 88,
    patterns: [/suspens[aã]o/i, /suspenso/i, /sobrestamento/i, /liminar.*suspend/i],
  },
  {
    code: 'objection_pending',
    polarity: 'negative',
    confidence: 84,
    patterns: [/impugna[cç][aã]o/i, /embargos/i, /valor\s+controvertido/i],
  },
  {
    code: 'beneficiary_inventory_pending',
    polarity: 'negative',
    confidence: 82,
    patterns: [/invent[aá]rio/i, /esp[oó]lio/i, /herdeir/i, /falecid/i],
  },
  {
    code: 'fee_dispute_detected',
    polarity: 'negative',
    confidence: 78,
    patterns: [/honor[aá]rios/i, /sucumb[eê]ncia/i, /contratuais/i],
  },
  {
    code: 'special_regime_declared',
    polarity: 'negative',
    confidence: 82,
    patterns: [/regime\s+especial/i, /morat[oó]ria/i],
  },
]

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
  const searchableText = buildSearchableText(movement)
  const matched: ClassifiedSignal[] = []

  for (const rule of SIGNAL_RULES) {
    const codeMatches = rule.movementCodes?.includes(movement.movementCode ?? -1) ?? false
    const textMatches = rule.patterns.some((pattern) => pattern.test(searchableText))

    if (!codeMatches && !textMatches) {
      continue
    }

    matched.push({
      code: rule.code,
      polarity: rule.polarity,
      confidence: rule.confidence,
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
        matchedBy: codeMatches ? 'movement_code_or_text' : 'text',
      },
    })
  }

  return matched
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
  ]
    .join(' ')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
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
