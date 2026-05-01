import { test } from '@japa/runner'
import liquidityAdvisoryService from '#modules/operations/services/liquidity_advisory_service'
import type { OpportunityProjection } from '#modules/operations/services/cession_pricing_engine'

test.group('liquidity advisory service', () => {
  test('recommends private cession when the opportunity is liquid and commercially attractive', ({
    assert,
  }) => {
    const advisory = liquidityAdvisoryService.evaluate(
      opportunityFixture({
        positiveSignals: ['payment_available', 'calculation_homologated'],
        riskAdjustedIrr: 0.34,
        paymentProbability: 0.93,
        finalScore: 0.9,
      })
    )

    assert.equal(advisory.readiness.status, 'ready')
    assert.isAtLeast(advisory.readiness.score, 80)
    assert.equal(advisory.channels.find((channel) => channel.recommended)?.key, 'private_cession')
    assert.include(advisory.insights.join(' '), 'TIR ajustada')
  })

  test('blocks liquidity when a prior cession is detected', ({ assert }) => {
    const advisory = liquidityAdvisoryService.evaluate(
      opportunityFixture({
        negativeSignals: ['prior_cession_detected'],
      })
    )

    assert.equal(advisory.readiness.status, 'blocked')
    assert.equal(advisory.checklist.find((item) => item.key === 'cession_chain')?.status, 'blocked')
    assert.equal(
      advisory.channels.find((channel) => channel.key === 'private_cession')?.fitScore,
      0
    )
  })
})

function opportunityFixture(
  overrides: {
    positiveSignals?: string[]
    negativeSignals?: string[]
    riskAdjustedIrr?: number
    paymentProbability?: number
    finalScore?: number
  } = {}
): OpportunityProjection {
  const positiveSignals = overrides.positiveSignals ?? []
  const negativeSignals = overrides.negativeSignals ?? []

  return {
    id: 'asset-1',
    asset: {
      id: 'asset-1',
      cnjNumber: '0001234-56.2024.4.03.6100',
      assetNumber: 'PRC-1',
      debtorName: 'Instituto Nacional do Seguro Social',
      debtorType: 'autarchy',
      nature: 'alimentar',
      lifecycleStatus: 'in_payment',
      faceValue: 1_200_000,
      estimatedUpdatedValue: 1_200_000,
      exerciseYear: 2024,
      budgetYear: 2026,
      currentScore: 92,
    },
    debtor: {
      id: 'debtor-1',
      name: 'Instituto Nacional do Seguro Social',
      paymentRegime: 'federal_unique',
      paymentReliabilityScore: 96,
      historicalMultiplier: 3.2,
      rclDebtRatio: 0.038,
      averagePaymentMonths: 14,
      onTimePaymentRate: 0.96,
      regimeSpecialActive: false,
      recentDefault: false,
    },
    pipeline: {
      stage: 'inbox',
      opportunityId: null,
      priority: 100,
      targetCloseAt: null,
      lastContactedAt: null,
    },
    pricing: {
      faceValue: 1_200_000,
      offerRate: 0.72,
      discountRate: 0.28,
      acquisitionCost: 864_000,
      termMonths: 14,
      annualCorrectionRate: 0.12,
      expectedPayment: 1_369_125,
      operationalCost: 18_000,
      taxRate: 0.15,
      estimatedTax: 75_768.75,
      netProceeds: 1_275_356.25,
      netProfit: 411_356.25,
      expectedAnnualIrr: 0.38,
      paymentProbability: overrides.paymentProbability ?? 0.92,
      riskAdjustedIrr: overrides.riskAdjustedIrr ?? 0.31,
      finalScore: overrides.finalScore ?? 0.86,
      grade: 'A+',
      decision: 'aggressive_buy',
      assumptions: {
        version: 'cession-pricing-v1',
        correctionRule: 'ec_136_min_ipca_plus_2_selic',
        taxModel: 'capital_gain_flat_rate',
        scoreModel: 'rule_based_v1',
        marketRatesAsOf: null,
      },
    },
    signals: {
      positive: positiveSignals.map((code, index) => ({
        code,
        label: code,
        polarity: 'positive',
        paymentMultiplier: 1.2,
        eventId: `positive-${index}`,
        eventDate: null,
      })),
      negative: negativeSignals.map((code, index) => ({
        code,
        label: code,
        polarity: 'negative',
        paymentMultiplier: 0.5,
        eventId: `negative-${index}`,
        eventDate: null,
      })),
    },
  }
}
