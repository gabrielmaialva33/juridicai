import type { OpportunityProjection } from '#modules/operations/services/cession_pricing_engine'
import type { LiquidityAdvisory } from '#modules/operations/services/liquidity_advisory_service'

type DossierChecklistItem = {
  label: string
  status: string
  reason: string
  action: string
}

export type LiquidityDossier = {
  version: 'liquidity-dossier-v1'
  generatedAt: string
  title: string
  asset: {
    id: string
    cnjNumber: string | null
    debtorName: string | null
    nature: string
    exerciseYear: number | null
    faceValue: number
    estimatedUpdatedValue: number | null
    pipelineStage: string
  }
  executiveSummary: {
    recommendation: string
    clientMessage: string
    buyerThesis: string
  }
  pricing: {
    offerValue: number
    expectedPayment: number
    netProfit: number
    termMonths: number
    expectedAnnualIrr: number
    riskAdjustedIrr: number
    paymentProbability: number
    grade: string
  }
  liquidity: {
    readinessLabel: string
    readinessScore: number
    recommendedChannel: string | null
    revenueOpportunity: string
  }
  diligence: {
    blocked: DossierChecklistItem[]
    review: DossierChecklistItem[]
    passed: DossierChecklistItem[]
    requiredDocuments: string[]
  }
  nextSteps: string[]
  markdown: string
}

class LiquidityDossierService {
  build(input: { opportunity: OpportunityProjection; liquidity: LiquidityAdvisory }) {
    const { opportunity, liquidity } = input
    const recommendedChannel = liquidity.channels.find((channel) => channel.recommended)
    const checklist = liquidity.checklist.map((item) => ({
      label: item.label,
      status: item.status,
      reason: item.reason,
      action: item.action,
    }))
    const dossier: Omit<LiquidityDossier, 'markdown'> = {
      version: 'liquidity-dossier-v1',
      generatedAt: new Date().toISOString(),
      title: dossierTitle(opportunity),
      asset: {
        id: opportunity.asset.id,
        cnjNumber: opportunity.asset.cnjNumber,
        debtorName: opportunity.asset.debtorName,
        nature: opportunity.asset.nature,
        exerciseYear: opportunity.asset.exerciseYear,
        faceValue: opportunity.pricing.faceValue,
        estimatedUpdatedValue: opportunity.asset.estimatedUpdatedValue,
        pipelineStage: opportunity.pipeline.stage,
      },
      executiveSummary: {
        recommendation: liquidity.clientAdvisory.headline,
        clientMessage: liquidity.clientAdvisory.clientMessage,
        buyerThesis: buyerThesis(opportunity, liquidity),
      },
      pricing: {
        offerValue: opportunity.pricing.acquisitionCost,
        expectedPayment: opportunity.pricing.expectedPayment,
        netProfit: opportunity.pricing.netProfit,
        termMonths: opportunity.pricing.termMonths,
        expectedAnnualIrr: opportunity.pricing.expectedAnnualIrr,
        riskAdjustedIrr: opportunity.pricing.riskAdjustedIrr,
        paymentProbability: opportunity.pricing.paymentProbability,
        grade: opportunity.pricing.grade,
      },
      liquidity: {
        readinessLabel: liquidity.readiness.label,
        readinessScore: liquidity.readiness.score,
        recommendedChannel: recommendedChannel?.title ?? null,
        revenueOpportunity: liquidity.clientAdvisory.revenueOpportunity.label,
      },
      diligence: {
        blocked: checklist.filter((item) => item.status === 'blocked'),
        review: checklist.filter((item) => item.status === 'review'),
        passed: checklist.filter((item) => item.status === 'passed'),
        requiredDocuments: liquidity.clientAdvisory.requiredDocuments,
      },
      nextSteps: liquidity.clientAdvisory.operatorNextSteps,
    }

    return {
      ...dossier,
      markdown: buildMarkdown(dossier),
    }
  }
}

function dossierTitle(opportunity: OpportunityProjection) {
  return `Dossiê de liquidez · ${opportunity.asset.debtorName ?? 'Devedor não identificado'} · ${
    opportunity.asset.cnjNumber ?? opportunity.asset.id.slice(0, 8)
  }`
}

function buyerThesis(opportunity: OpportunityProjection, liquidity: LiquidityAdvisory) {
  const recommendedChannel = liquidity.channels.find((channel) => channel.recommended)

  return [
    `Classe ${opportunity.pricing.grade} com retorno estimado de ${formatPercent(
      opportunity.pricing.riskAdjustedIrr
    )}.`,
    `Probabilidade de pagamento estimada em ${formatPercent(
      opportunity.pricing.paymentProbability
    )}.`,
    recommendedChannel
      ? `Canal recomendado: ${recommendedChannel.title}, com fit ${recommendedChannel.fitScore}/100.`
      : 'Sem canal recomendado acima do limiar mínimo.',
  ].join(' ')
}

function buildMarkdown(dossier: Omit<LiquidityDossier, 'markdown'>) {
  const blocked = dossier.diligence.blocked.map(markChecklistItem).join('\n') || '- Nenhum'
  const review = dossier.diligence.review.map(markChecklistItem).join('\n') || '- Nenhum'
  const nextSteps = dossier.nextSteps.map((step) => `- ${step}`).join('\n')
  const documents = dossier.diligence.requiredDocuments.map((doc) => `- ${doc}`).join('\n')

  return [
    `# ${dossier.title}`,
    '',
    `Gerado em: ${dossier.generatedAt}`,
    '',
    '## Resumo executivo',
    '',
    `**Recomendação:** ${dossier.executiveSummary.recommendation}`,
    '',
    dossier.executiveSummary.clientMessage,
    '',
    '## Tese para comprador',
    '',
    dossier.executiveSummary.buyerThesis,
    '',
    '## Precificação',
    '',
    `- Base da proposta: ${formatMoney(dossier.pricing.offerValue)}`,
    `- Recebimento esperado: ${formatMoney(dossier.pricing.expectedPayment)}`,
    `- Retorno estimado: ${formatPercent(dossier.pricing.riskAdjustedIrr)}`,
    `- Prazo provável: ${dossier.pricing.termMonths} meses`,
    `- Probabilidade de pagamento: ${formatPercent(dossier.pricing.paymentProbability)}`,
    '',
    '## Diligência',
    '',
    `**Bloqueios**`,
    blocked,
    '',
    `**Pendências de revisão**`,
    review,
    '',
    '## Documentos',
    '',
    documents,
    '',
    '## Próximos passos',
    '',
    nextSteps,
  ].join('\n')
}

function markChecklistItem(item: DossierChecklistItem) {
  return `- ${item.label}: ${item.reason} Ação: ${item.action}`
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercent(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value)
}

export const liquidityDossierService = new LiquidityDossierService()
export default liquidityDossierService
