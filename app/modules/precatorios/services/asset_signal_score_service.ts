import { createHash } from 'node:crypto'
import AssetScore from '#modules/precatorios/models/asset_score'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import type AssetEvent from '#modules/precatorios/models/asset_event'
import { assetValueSnapshot } from '#modules/precatorios/helpers/asset_values'
import type { JsonRecord } from '#shared/types/model_enums'

const SCORE_VERSION = 'legal-signals-v1'

const POSITIVE_WEIGHTS: Record<string, number> = {
  direct_agreement_opened: 18,
  superpreference_granted: 16,
  payment_available: 22,
  final_judgment: 10,
  calculation_homologated: 9,
  requisition_issued: 8,
}

const NEGATIVE_WEIGHTS: Record<string, number> = {
  prior_cession_detected: 100,
  lien_detected: 28,
  suspension_detected: 42,
  objection_pending: 28,
  beneficiary_inventory_pending: 36,
  fee_dispute_detected: 18,
  special_regime_declared: 22,
}

class AssetSignalScoreService {
  async refresh(tenantId: string, assetId: string) {
    const asset = await PrecatorioAsset.query()
      .where('tenant_id', tenantId)
      .where('id', assetId)
      .preload('events', (query) => query.orderBy('event_date', 'desc').limit(200))
      .preload('valuations', (query) => query.orderBy('computed_at', 'desc').limit(1))
      .firstOrFail()
    const events = (asset.events ?? []) as AssetEvent[]
    const snapshot = buildScoreSnapshot(asset, events)
    const latest = await AssetScore.query()
      .where('tenant_id', tenantId)
      .where('asset_id', assetId)
      .where('score_version', SCORE_VERSION)
      .orderBy('computed_at', 'desc')
      .first()

    if (latest?.explanation?.fingerprint === snapshot.fingerprint) {
      asset.currentScore = latest.finalScore
      asset.currentScoreId = latest.id
      await asset.save()
      return { score: latest, created: false }
    }

    const score = await AssetScore.create({
      tenantId,
      assetId,
      scoreVersion: SCORE_VERSION,
      dataQualityScore: snapshot.dataQualityScore,
      maturityScore: snapshot.maturityScore,
      liquidityScore: snapshot.liquidityScore,
      legalSignalScore: snapshot.legalSignalScore,
      economicScore: snapshot.economicScore,
      riskScore: snapshot.riskScore,
      finalScore: snapshot.finalScore,
      explanation: snapshot.explanation,
    })

    asset.currentScore = score.finalScore
    asset.currentScoreId = score.id
    await asset.save()

    return { score, created: true }
  }
}

function buildScoreSnapshot(asset: PrecatorioAsset, events: AssetEvent[]) {
  const positiveEvents = events.filter((event) => event.eventType in POSITIVE_WEIGHTS)
  const negativeEvents = events.filter((event) => event.eventType in NEGATIVE_WEIGHTS)
  const positiveWeight = positiveEvents.reduce(
    (total, event) => total + (POSITIVE_WEIGHTS[event.eventType] ?? 0),
    0
  )
  const negativeWeight = negativeEvents.reduce(
    (total, event) => total + (NEGATIVE_WEIGHTS[event.eventType] ?? 0),
    0
  )
  const legalSignalScore = negativeEvents.some(
    (event) => event.eventType === 'prior_cession_detected'
  )
    ? 0
    : clamp(50 + positiveWeight - negativeWeight, 0, 100)
  const valueSnapshot = assetValueSnapshot(asset)
  const dataQualityScore =
    [
      asset.cnjNumber,
      asset.debtorId,
      valueSnapshot.faceValue > 0 ? valueSnapshot.faceValue : null,
    ].filter(Boolean).length * 30
  const maturityScore = clamp(
    40 +
      (positiveEvents.some((event) => event.eventType === 'requisition_issued') ? 20 : 0) +
      (positiveEvents.some((event) => event.eventType === 'final_judgment') ? 15 : 0) +
      (positiveEvents.some((event) => event.eventType === 'calculation_homologated') ? 15 : 0),
    0,
    100
  )
  const liquidityScore = clamp(
    45 +
      (positiveEvents.some((event) => event.eventType === 'payment_available') ? 35 : 0) +
      (positiveEvents.some((event) => event.eventType === 'direct_agreement_opened') ? 25 : 0) +
      (positiveEvents.some((event) => event.eventType === 'superpreference_granted') ? 20 : 0) -
      negativeWeight / 2,
    0,
    100
  )
  const economicScore = clamp(valueSnapshot.faceValue >= 50_000 ? 70 : 45, 0, 100)
  const riskScore = clamp(100 - legalSignalScore + negativeWeight / 2, 0, 100)
  const finalScore = clamp(
    Math.round(
      dataQualityScore * 0.2 +
        maturityScore * 0.2 +
        liquidityScore * 0.2 +
        legalSignalScore * 0.3 +
        economicScore * 0.1 -
        riskScore * 0.1
    ),
    0,
    100
  )
  const fingerprint = fingerprintEvents(events)

  return {
    fingerprint,
    dataQualityScore,
    maturityScore,
    liquidityScore,
    legalSignalScore,
    economicScore,
    riskScore,
    finalScore,
    explanation: {
      source: 'datajud_legal_signals',
      version: SCORE_VERSION,
      fingerprint,
      positiveSignals: summarizeEvents(positiveEvents),
      negativeSignals: summarizeEvents(negativeEvents),
      weights: {
        positiveWeight,
        negativeWeight,
      },
    } satisfies JsonRecord,
  }
}

function fingerprintEvents(events: AssetEvent[]) {
  return createHash('sha256')
    .update(
      JSON.stringify(
        events
          .filter(
            (event) => event.eventType in POSITIVE_WEIGHTS || event.eventType in NEGATIVE_WEIGHTS
          )
          .map((event) => ({
            id: event.id,
            type: event.eventType,
            date: event.eventDate?.toISO() ?? null,
          }))
          .sort((left, right) =>
            `${left.type}:${left.id}`.localeCompare(`${right.type}:${right.id}`)
          )
      )
    )
    .digest('hex')
}

function summarizeEvents(events: AssetEvent[]) {
  return events.map((event) => ({
    eventId: event.id,
    eventType: event.eventType,
    eventDate: event.eventDate?.toISO() ?? null,
  }))
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export const assetSignalScoreService = new AssetSignalScoreService()
export default assetSignalScoreService
