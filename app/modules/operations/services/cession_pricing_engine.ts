import type Debtor from '#modules/debtors/models/debtor'
import type DebtorPaymentStat from '#modules/debtors/models/debtor_payment_stat'
import type AssetEvent from '#modules/precatorios/models/asset_event'
import type PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import type {
  CessionPipelineStage,
  OpportunityGrade,
} from '#modules/operations/models/cession_opportunity'
import { assetValueSnapshot } from '#modules/precatorios/helpers/asset_values'
import type { DebtorType, PaymentRegime } from '#shared/types/model_enums'

const DEFAULT_ANNUAL_CORRECTION_RATE = 0.12
const DEFAULT_TAX_RATE = 0.15
const DEFAULT_OPERATIONAL_COST_RATE = 0.015

const POSITIVE_EVENT_SIGNALS: Record<string, EventSignalDefinition> = {
  direct_agreement_opened: {
    code: 'direct_agreement_opened',
    label: 'Direct agreement opened',
    polarity: 'positive',
    paymentMultiplier: 1.6,
  },
  direct_agreement_window: {
    code: 'direct_agreement_window',
    label: 'Direct agreement window',
    polarity: 'positive',
    paymentMultiplier: 1.45,
  },
  superpreference_granted: {
    code: 'superpreference_granted',
    label: 'Superpreference granted',
    polarity: 'positive',
    paymentMultiplier: 1.4,
  },
  preferential_queue: {
    code: 'preferential_queue',
    label: 'Preferential queue',
    polarity: 'positive',
    paymentMultiplier: 1.25,
  },
  payment_available: {
    code: 'payment_available',
    label: 'Payment available',
    polarity: 'positive',
    paymentMultiplier: 1.9,
  },
  payment_process_detected: {
    code: 'payment_process_detected',
    label: 'Payment process detected',
    polarity: 'positive',
    paymentMultiplier: 1.35,
  },
  queue_position_favorable: {
    code: 'queue_position_favorable',
    label: 'Favorable queue position',
    polarity: 'positive',
    paymentMultiplier: 1.18,
  },
  final_judgment: {
    code: 'final_judgment',
    label: 'Final judgment',
    polarity: 'positive',
    paymentMultiplier: 1.12,
  },
  calculation_homologated: {
    code: 'calculation_homologated',
    label: 'Calculation homologated',
    polarity: 'positive',
    paymentMultiplier: 1.1,
  },
  requisition_issued: {
    code: 'requisition_issued',
    label: 'Payment requisition issued',
    polarity: 'positive',
    paymentMultiplier: 1.08,
  },
}

const NEGATIVE_EVENT_SIGNALS: Record<string, EventSignalDefinition> = {
  prior_cession_detected: {
    code: 'prior_cession_detected',
    label: 'Prior cession detected',
    polarity: 'negative',
    paymentMultiplier: 0,
  },
  lien_detected: {
    code: 'lien_detected',
    label: 'Lien detected',
    polarity: 'negative',
    paymentMultiplier: 0.6,
  },
  suspension_detected: {
    code: 'suspension_detected',
    label: 'Suspension detected',
    polarity: 'negative',
    paymentMultiplier: 0.3,
  },
  objection_pending: {
    code: 'objection_pending',
    label: 'Objection pending',
    polarity: 'negative',
    paymentMultiplier: 0.55,
  },
  beneficiary_inventory_pending: {
    code: 'beneficiary_inventory_pending',
    label: 'Beneficiary inventory pending',
    polarity: 'negative',
    paymentMultiplier: 0.45,
  },
  fee_dispute_detected: {
    code: 'fee_dispute_detected',
    label: 'Fee dispute detected',
    polarity: 'negative',
    paymentMultiplier: 0.7,
  },
  special_regime_declared: {
    code: 'special_regime_declared',
    label: 'Special payment regime declared',
    polarity: 'negative',
    paymentMultiplier: 0.7,
  },
  queue_position_unknown: {
    code: 'queue_position_unknown',
    label: 'Queue position unknown',
    polarity: 'negative',
    paymentMultiplier: 0.95,
  },
}

export type EventSignal = EventSignalDefinition & {
  eventId: string
  eventDate: string | null
}

export type PricingInput = {
  offerRate?: number | null
  discountRate?: number | null
  termMonths?: number | null
  annualCorrectionRate?: number | null
  operationalCost?: number | null
  operationalCostRate?: number | null
  taxRate?: number | null
}

export type MarketRatePricingSnapshot = {
  cdiAnnualRate: number | null
  selicAnnualRate: number | null
  ipcaAnnualRate: number | null
  ec136CorrectionAnnualRate: number
  asOf: string | null
}

export type PricingResult = {
  faceValue: number
  offerRate: number
  discountRate: number
  acquisitionCost: number
  termMonths: number
  annualCorrectionRate: number
  expectedPayment: number
  operationalCost: number
  taxRate: number
  estimatedTax: number
  netProceeds: number
  netProfit: number
  expectedAnnualIrr: number
  paymentProbability: number
  riskAdjustedIrr: number
  finalScore: number
  grade: OpportunityGrade
  decision: 'aggressive_buy' | 'buy' | 'watch' | 'avoid'
  explanation: PricingExplanation
  assumptions: {
    version: 'cession-pricing-v1'
    correctionRule: 'ec_136_min_ipca_plus_2_selic'
    taxModel: 'capital_gain_flat_rate'
    scoreModel: 'rule_based_v1'
    marketRatesAsOf: string | null
  }
}

export type PricingExplanation = {
  headline: string
  summary: string
  scoreBreakdown: {
    riskAdjustedIrr: ScoreContribution
    paymentProbability: ScoreContribution
    termMonths: ScoreContribution
    faceValue: ScoreContribution
  }
  signalImpacts: Array<{
    code: string
    label: string
    polarity: 'positive' | 'negative'
    paymentMultiplier: number
    eventDate: string | null
  }>
  pricingFactors: Array<{
    key: string
    label: string
    impact: 'positive' | 'negative' | 'neutral'
    value: number | string | null
    detail: string
  }>
}

export type ScoreContribution = {
  value: number
  normalized: number
  weight: number
  contribution: number
}

export type OpportunityProjection = {
  id: string
  asset: {
    id: string
    cnjNumber: string | null
    assetNumber: string | null
    debtorName: string | null
    debtorType: DebtorType | null
    nature: string
    lifecycleStatus: string
    faceValue: number
    estimatedUpdatedValue: number | null
    exerciseYear: number | null
    budgetYear: number | null
    currentScore: number | null
  }
  debtor: {
    id: string | null
    name: string | null
    paymentRegime: PaymentRegime | null
    paymentReliabilityScore: number
    historicalMultiplier: number
    rclDebtRatio: number | null
    averagePaymentMonths: number | null
    onTimePaymentRate: number | null
    regimeSpecialActive: boolean
    recentDefault: boolean
  }
  pipeline: {
    stage: CessionPipelineStage
    opportunityId: string | null
    priority: number
    targetCloseAt: string | null
    lastContactedAt: string | null
  }
  pricing: PricingResult
  signals: {
    positive: EventSignal[]
    negative: EventSignal[]
  }
}

type EventSignalDefinition = {
  code: string
  label: string
  polarity: 'positive' | 'negative'
  paymentMultiplier: number
}

class CessionPricingEngine {
  project(
    asset: PrecatorioAsset,
    options: {
      debtor?: Debtor | null
      debtorPaymentStat?: DebtorPaymentStat | null
      events?: AssetEvent[]
      marketRates?: MarketRatePricingSnapshot | null
      stage?: CessionPipelineStage
      opportunityId?: string | null
      priority?: number
      targetCloseAt?: string | null
      lastContactedAt?: string | null
      pricing?: PricingInput
    } = {}
  ): OpportunityProjection {
    const debtor = options.debtor ?? null
    const debtorPaymentStat = options.debtorPaymentStat ?? latestPaymentStat(debtor)
    const events = options.events ?? []
    const valueSnapshot = assetValueSnapshot(asset)
    const faceValue = valueSnapshot.faceValue
    const pricing = this.calculate({
      asset,
      debtor,
      debtorPaymentStat,
      events,
      marketRates: options.marketRates,
      input: options.pricing,
    })
    const paymentReliabilityScore =
      debtorPaymentStat?.reliabilityScore ??
      debtor?.paymentReliabilityScore ??
      defaultReliabilityScore(debtor)

    return {
      id: asset.id,
      asset: {
        id: asset.id,
        cnjNumber: asset.cnjNumber,
        assetNumber: asset.assetNumber,
        debtorName: debtor?.name ?? null,
        debtorType: debtor?.debtorType ?? null,
        nature: asset.nature,
        lifecycleStatus: asset.lifecycleStatus,
        faceValue,
        estimatedUpdatedValue: valueSnapshot.estimatedUpdatedValue,
        exerciseYear: asset.exerciseYear,
        budgetYear: asset.budgetYear,
        currentScore: asset.currentScore,
      },
      debtor: {
        id: debtor?.id ?? null,
        name: debtor?.name ?? null,
        paymentRegime: debtor?.paymentRegime ?? null,
        paymentReliabilityScore,
        historicalMultiplier: round(paymentReliabilityScore / 30, 2),
        rclDebtRatio: statNumber(debtorPaymentStat?.rclDebtRatio) ?? debtStockRatio(debtor),
        averagePaymentMonths: debtorPaymentStat?.averagePaymentMonths ?? null,
        onTimePaymentRate: statNumber(debtorPaymentStat?.onTimePaymentRate),
        regimeSpecialActive: debtorPaymentStat?.regimeSpecialActive ?? false,
        recentDefault: debtorPaymentStat?.recentDefault ?? false,
      },
      pipeline: {
        stage: options.stage ?? 'inbox',
        opportunityId: options.opportunityId ?? null,
        priority: options.priority ?? 0,
        targetCloseAt: options.targetCloseAt ?? null,
        lastContactedAt: options.lastContactedAt ?? null,
      },
      pricing,
      signals: classifySignals(events, asset),
    }
  }

  calculate(input: {
    asset: PrecatorioAsset
    debtor?: Debtor | null
    debtorPaymentStat?: DebtorPaymentStat | null
    events?: AssetEvent[]
    marketRates?: MarketRatePricingSnapshot | null
    input?: PricingInput | null
  }): PricingResult {
    const asset = input.asset
    const debtor = input.debtor ?? null
    const debtorPaymentStat = input.debtorPaymentStat ?? latestPaymentStat(debtor)
    const events = input.events ?? []
    const pricingInput = input.input ?? {}
    const marketRates = input.marketRates ?? null
    const faceValue = assetValueSnapshot(asset).faceValue
    const termMonths = Math.max(
      1,
      Math.round(pricingInput.termMonths ?? defaultTermMonths(asset, debtor, events))
    )
    const offerRate = resolveOfferRate(asset, debtor, pricingInput)
    const acquisitionCost = faceValue * offerRate
    const annualCorrectionRate = normalizedRate(
      pricingInput.annualCorrectionRate,
      marketRates?.ec136CorrectionAnnualRate ?? DEFAULT_ANNUAL_CORRECTION_RATE
    )
    const expectedPayment = faceValue * Math.pow(1 + annualCorrectionRate, termMonths / 12)
    const operationalCost =
      pricingInput.operationalCost ??
      faceValue * normalizedRate(pricingInput.operationalCostRate, DEFAULT_OPERATIONAL_COST_RATE)
    const taxRate = normalizedRate(pricingInput.taxRate, DEFAULT_TAX_RATE)
    const grossGain = Math.max(expectedPayment - acquisitionCost, 0)
    const estimatedTax = grossGain * taxRate
    const netProceeds = expectedPayment - operationalCost - estimatedTax
    const netProfit = netProceeds - acquisitionCost
    // Annualized IRR guard: short terms (<6m) use linear annualization to avoid
    // exponential blowups. The upper cap is defensive at 200% a.a.
    const rawIrr =
      acquisitionCost > 0
        ? termMonths >= 6
          ? Math.pow(netProceeds / acquisitionCost, 12 / termMonths) - 1
          : ((netProceeds - acquisitionCost) / acquisitionCost) * (12 / termMonths)
        : 0
    const expectedAnnualIrr = clamp(rawIrr, -1, 2)
    const paymentProbability = estimatePaymentProbability(asset, debtor, debtorPaymentStat, events)
    const riskAdjustedIrr = clamp(expectedAnnualIrr * paymentProbability, -1, 2)
    const scoreBreakdown = scoreOpportunityBreakdown({
      riskAdjustedIrr,
      paymentProbability,
      termMonths,
      faceValue,
    })
    const finalScore = scoreBreakdown.finalScore
    const grade = gradeFromScore(finalScore)
    const classifiedSignals = classifySignals(events, asset)
    const decision = decisionFromGrade(grade)

    return {
      faceValue: roundMoney(faceValue),
      offerRate: round(offerRate, 6),
      discountRate: round(1 - offerRate, 6),
      acquisitionCost: roundMoney(acquisitionCost),
      termMonths,
      annualCorrectionRate: round(annualCorrectionRate, 6),
      expectedPayment: roundMoney(expectedPayment),
      operationalCost: roundMoney(operationalCost),
      taxRate: round(taxRate, 6),
      estimatedTax: roundMoney(estimatedTax),
      netProceeds: roundMoney(netProceeds),
      netProfit: roundMoney(netProfit),
      expectedAnnualIrr: round(expectedAnnualIrr, 6),
      paymentProbability: round(paymentProbability, 6),
      riskAdjustedIrr: round(riskAdjustedIrr, 6),
      finalScore: round(finalScore, 6),
      grade,
      decision,
      explanation: buildPricingExplanation({
        asset,
        debtor,
        debtorPaymentStat,
        decision,
        grade,
        scoreBreakdown,
        signals: classifiedSignals,
        faceValue,
        offerRate,
        termMonths,
        expectedAnnualIrr,
        paymentProbability,
        riskAdjustedIrr,
      }),
      assumptions: {
        version: 'cession-pricing-v1',
        correctionRule: 'ec_136_min_ipca_plus_2_selic',
        taxModel: 'capital_gain_flat_rate',
        scoreModel: 'rule_based_v1',
        marketRatesAsOf: marketRates?.asOf ?? null,
      },
    }
  }
}

function resolveOfferRate(asset: PrecatorioAsset, debtor: Debtor | null, input: PricingInput) {
  if (input.offerRate !== null && input.offerRate !== undefined) {
    return clamp(normalizedRate(input.offerRate, 0.7), 0.01, 0.99)
  }

  if (input.discountRate !== null && input.discountRate !== undefined) {
    return clamp(1 - normalizedRate(input.discountRate, 0.3), 0.01, 0.99)
  }

  if (asset.nature === 'alimentar') {
    return 0.72
  }

  switch (debtor?.debtorType) {
    case 'union':
    case 'autarchy':
    case 'foundation':
      return 0.78
    case 'state':
      return 0.6
    case 'municipality':
      return 0.35
    default:
      return 0.65
  }
}

function defaultTermMonths(asset: PrecatorioAsset, debtor: Debtor | null, events: AssetEvent[]) {
  const debtorPaymentStat = latestPaymentStat(debtor)

  if (debtorPaymentStat?.averagePaymentMonths) {
    return debtorPaymentStat.averagePaymentMonths
  }

  const signals = classifySignals(events, asset)

  if (signals.positive.some((signal) => signal.code === 'payment_available')) {
    return 12
  }

  if (signals.positive.some((signal) => signal.code === 'payment_process_detected')) {
    return 12
  }

  if (signals.positive.some((signal) => signal.code === 'superpreference_granted')) {
    return 10
  }

  if (signals.positive.some((signal) => signal.code === 'preferential_queue')) {
    return 12
  }

  if (signals.positive.some((signal) => signal.code === 'direct_agreement_window')) {
    return 18
  }

  const queuePosition = assetValueSnapshot(asset).queuePosition
  if (queuePosition !== null && queuePosition <= 25) {
    return 12
  }

  if (queuePosition !== null && queuePosition <= 100) {
    return 18
  }

  if (asset.lifecycleStatus === 'in_payment') {
    return 12
  }

  if (asset.lifecycleStatus === 'paid') {
    // Paid assets without real duration history use a conservative placeholder
    // to avoid exponential blowups in annualized return calculations.
    return debtorPaymentStat?.averagePaymentMonths ?? 12
  }

  if (debtor?.paymentRegime === 'special') {
    return 72
  }

  switch (debtor?.debtorType) {
    case 'union':
    case 'autarchy':
    case 'foundation':
      return 24
    case 'state':
      return 42
    case 'municipality':
      return 60
    default:
      return 36
  }
}

function estimatePaymentProbability(
  asset: PrecatorioAsset,
  debtor: Debtor | null,
  debtorPaymentStat: DebtorPaymentStat | null,
  events: AssetEvent[]
) {
  let probability =
    statNumber(debtorPaymentStat?.onTimePaymentRate) ??
    (debtorPaymentStat?.reliabilityScore ??
      debtor?.paymentReliabilityScore ??
      defaultReliabilityScore(debtor)) / 100
  const signals = classifySignals(events, asset)

  if (debtorPaymentStat?.regimeSpecialActive || debtor?.paymentRegime === 'special') {
    probability *= 0.7
  }

  if (debtorPaymentStat?.recentDefault) {
    probability *= 0.55
  }

  for (const signal of [...signals.positive, ...signals.negative]) {
    probability *= signal.paymentMultiplier
  }

  return clamp(probability, 0, 1)
}

function latestPaymentStat(debtor: Debtor | null) {
  const stats = debtor?.$preloaded.paymentStats as DebtorPaymentStat[] | undefined
  return stats?.[0] ?? null
}

function classifySignals(events: AssetEvent[], asset: PrecatorioAsset) {
  const positive: EventSignal[] = []
  const negative: EventSignal[] = []

  for (const event of events) {
    const positiveSignal = POSITIVE_EVENT_SIGNALS[event.eventType]
    const negativeSignal = NEGATIVE_EVENT_SIGNALS[event.eventType]
    const signal = positiveSignal ?? negativeSignal

    if (!signal) {
      continue
    }

    const projected = {
      ...signal,
      eventId: event.id,
      eventDate: event.eventDate?.toISO() ?? null,
    }

    if (projected.polarity === 'positive') {
      positive.push(projected)
    } else {
      negative.push(projected)
    }
  }

  if (asset.lifecycleStatus === 'in_payment') {
    positive.push({
      ...POSITIVE_EVENT_SIGNALS.payment_available,
      eventId: `asset:${asset.id}:lifecycle_status`,
      eventDate: null,
    })
  }

  if (asset.lifecycleStatus === 'suspended') {
    negative.push({
      ...NEGATIVE_EVENT_SIGNALS.suspension_detected,
      eventId: `asset:${asset.id}:lifecycle_status`,
      eventDate: null,
    })
  }

  return { positive, negative }
}

function scoreOpportunityBreakdown(input: {
  riskAdjustedIrr: number
  paymentProbability: number
  termMonths: number
  faceValue: number
}) {
  const riskAdjustedIrr = contribution(
    input.riskAdjustedIrr,
    normalize(input.riskAdjustedIrr, 0.05, 0.6),
    0.4
  )
  const paymentProbability = contribution(
    input.paymentProbability,
    normalize(input.paymentProbability, 0, 1),
    0.25
  )
  const termMonths = contribution(input.termMonths, inverseNormalize(input.termMonths, 1, 60), 0.2)
  const faceValue = contribution(
    input.faceValue,
    normalize(input.faceValue, 50_000, 5_000_000),
    0.15
  )
  const finalScore =
    riskAdjustedIrr.contribution +
    paymentProbability.contribution +
    termMonths.contribution +
    faceValue.contribution

  return {
    riskAdjustedIrr,
    paymentProbability,
    termMonths,
    faceValue,
    finalScore,
  }
}

function buildPricingExplanation(input: {
  asset: PrecatorioAsset
  debtor: Debtor | null
  debtorPaymentStat: DebtorPaymentStat | null
  decision: PricingResult['decision']
  grade: OpportunityGrade
  scoreBreakdown: ReturnType<typeof scoreOpportunityBreakdown>
  signals: { positive: EventSignal[]; negative: EventSignal[] }
  faceValue: number
  offerRate: number
  termMonths: number
  expectedAnnualIrr: number
  paymentProbability: number
  riskAdjustedIrr: number
}): PricingExplanation {
  const signalImpacts = [...input.signals.positive, ...input.signals.negative].map((signal) => ({
    code: signal.code,
    label: signal.label,
    polarity: signal.polarity,
    paymentMultiplier: signal.paymentMultiplier,
    eventDate: signal.eventDate,
  }))

  return {
    headline: headlineFor(input.decision, input.grade),
    summary: summaryFor(input),
    scoreBreakdown: {
      riskAdjustedIrr: normalizeContribution(input.scoreBreakdown.riskAdjustedIrr),
      paymentProbability: normalizeContribution(input.scoreBreakdown.paymentProbability),
      termMonths: normalizeContribution(input.scoreBreakdown.termMonths),
      faceValue: normalizeContribution(input.scoreBreakdown.faceValue),
    },
    signalImpacts,
    pricingFactors: pricingFactorsFor(input),
  }
}

function pricingFactorsFor(input: {
  asset: PrecatorioAsset
  debtor: Debtor | null
  debtorPaymentStat: DebtorPaymentStat | null
  faceValue: number
  offerRate: number
  termMonths: number
  expectedAnnualIrr: number
  paymentProbability: number
  riskAdjustedIrr: number
  signals: { positive: EventSignal[]; negative: EventSignal[] }
}) {
  const queuePosition = assetValueSnapshot(input.asset).queuePosition
  const positiveSignals = input.signals.positive.length
  const negativeSignals = input.signals.negative.length

  return [
    {
      key: 'risk_adjusted_irr',
      label: 'Risk-adjusted IRR',
      impact: input.riskAdjustedIrr >= 0.25 ? 'positive' : 'neutral',
      value: round(input.riskAdjustedIrr, 6),
      detail: 'Primary ranking metric after payment probability is applied.',
    },
    {
      key: 'payment_probability',
      label: 'Payment probability',
      impact: input.paymentProbability >= 0.75 ? 'positive' : 'neutral',
      value: round(input.paymentProbability, 6),
      detail: reliabilityDetail(input),
    },
    {
      key: 'estimated_term',
      label: 'Estimated term',
      impact: input.termMonths <= 18 ? 'positive' : input.termMonths >= 60 ? 'negative' : 'neutral',
      value: input.termMonths,
      detail: termDetail(input, queuePosition),
    },
    {
      key: 'offer_rate',
      label: 'Offer rate',
      impact: input.offerRate <= 0.6 ? 'positive' : 'neutral',
      value: round(input.offerRate, 6),
      detail:
        'Lower acquisition cost increases expected spread but must remain commercially executable.',
    },
    {
      key: 'signals',
      label: 'Signals',
      impact: negativeSignals > 0 ? 'negative' : positiveSignals > 0 ? 'positive' : 'neutral',
      value: `${positiveSignals} positive / ${negativeSignals} negative`,
      detail: 'DJEN, DataJud, tribunal queue and payment documents change payment probability.',
    },
  ] satisfies PricingExplanation['pricingFactors']
}

function reliabilityDetail(input: {
  debtor: Debtor | null
  debtorPaymentStat: DebtorPaymentStat | null
}) {
  if (input.debtorPaymentStat?.onTimePaymentRate) {
    return 'Uses historical on-time payment rate for the debtor.'
  }

  if (input.debtorPaymentStat?.reliabilityScore || input.debtor?.paymentReliabilityScore) {
    return 'Uses debtor reliability score when historical payment rate is unavailable.'
  }

  return 'Uses conservative default reliability by debtor type.'
}

function termDetail(
  input: {
    asset: PrecatorioAsset
    signals: { positive: EventSignal[]; negative: EventSignal[] }
  },
  queuePosition: number | null
) {
  if (hasSignal(input.signals.positive, 'payment_available')) {
    return 'Payment available signal sets a short expected exit window.'
  }

  if (hasSignal(input.signals.positive, 'payment_process_detected')) {
    return 'Payment-process document indicates near-term liquidity.'
  }

  if (hasSignal(input.signals.positive, 'superpreference_granted')) {
    return 'Superpreference signal shortens expected queue time.'
  }

  if (queuePosition !== null && queuePosition <= 100) {
    return `Queue position ${queuePosition} shortens the estimated term.`
  }

  return 'Falls back to debtor type, payment regime and lifecycle status.'
}

function headlineFor(decision: PricingResult['decision'], grade: OpportunityGrade) {
  switch (decision) {
    case 'aggressive_buy':
      return `Grade ${grade}: prioritize commercial action`
    case 'buy':
      return `Grade ${grade}: commercially attractive`
    case 'watch':
      return `Grade ${grade}: monitor and complete diligence`
    case 'avoid':
      return `Grade ${grade}: avoid until risk clears`
  }
}

function summaryFor(input: {
  grade: OpportunityGrade
  riskAdjustedIrr: number
  paymentProbability: number
  termMonths: number
  signals: { positive: EventSignal[]; negative: EventSignal[] }
}) {
  return [
    `Score ${input.grade} from ${percent(input.riskAdjustedIrr)} risk-adjusted IRR`,
    `${percent(input.paymentProbability)} payment probability`,
    `${input.termMonths} month estimated term`,
    `${input.signals.positive.length} positive and ${input.signals.negative.length} negative signals`,
  ].join(', ')
}

function contribution(value: number, normalized: number, weight: number): ScoreContribution {
  return {
    value,
    normalized,
    weight,
    contribution: normalized * weight,
  }
}

function normalizeContribution(item: ScoreContribution): ScoreContribution {
  return {
    value: round(item.value, 6),
    normalized: round(item.normalized, 6),
    weight: item.weight,
    contribution: round(item.contribution, 6),
  }
}

function hasSignal(signals: EventSignal[], code: string) {
  return signals.some((signal) => signal.code === code)
}

function percent(value: number) {
  return `${round(value * 100, 2)}%`
}

function gradeFromScore(score: number): OpportunityGrade {
  if (score >= 0.85) return 'A+'
  if (score >= 0.7) return 'A'
  if (score >= 0.55) return 'B+'
  if (score >= 0.4) return 'B'
  if (score >= 0.25) return 'C'
  return 'D'
}

function decisionFromGrade(grade: OpportunityGrade): PricingResult['decision'] {
  if (grade === 'A+') return 'aggressive_buy'
  if (grade === 'A' || grade === 'B+') return 'buy'
  if (grade === 'B' || grade === 'C') return 'watch'
  return 'avoid'
}

function defaultReliabilityScore(debtor: Debtor | null) {
  switch (debtor?.debtorType) {
    case 'union':
    case 'autarchy':
    case 'foundation':
      return 88
    case 'state':
      return debtor.paymentRegime === 'special' ? 52 : 68
    case 'municipality':
      return 42
    default:
      return 55
  }
}

function debtStockRatio(debtor: Debtor | null) {
  const debt = moneyToNumber(debtor?.debtStockEstimate ?? null)
  const rcl = moneyToNumber(debtor?.rclEstimate ?? null)

  if (!debt || !rcl) {
    return null
  }

  return round(debt / rcl, 6)
}

function normalizedRate(value: number | null | undefined, fallback: number) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return fallback
  }

  return value > 1 ? value / 100 : value
}

function normalize(value: number, min: number, max: number) {
  return clamp((value - min) / (max - min), 0, 1)
}

function inverseNormalize(value: number, min: number, max: number) {
  return 1 - normalize(value, min, max)
}

function moneyToNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function statNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function round(value: number, fractionDigits: number) {
  return Number(value.toFixed(fractionDigits))
}

function roundMoney(value: number) {
  return round(value, 2)
}

export const cessionPricingEngine = new CessionPricingEngine()
export default cessionPricingEngine
