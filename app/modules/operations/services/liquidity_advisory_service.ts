import type {
  EventSignal,
  OpportunityProjection,
} from '#modules/operations/services/cession_pricing_engine'

type ChecklistStatus = 'passed' | 'review' | 'blocked'
type LiquidityReadiness = 'ready' | 'review' | 'blocked'
type LiquidityChannelKey = 'private_cession' | 'direct_agreement' | 'hold_and_wait' | 'bridge_loan'

export type LiquidityChecklistItem = {
  key: string
  label: string
  status: ChecklistStatus
  reason: string
  action: string
}

export type LiquidityChannel = {
  key: LiquidityChannelKey
  title: string
  fitScore: number
  recommended: boolean
  value: number
  termMonths: number
  annualRate: number | null
  rationale: string
  nextAction: string
}

export type ClientAdvisory = {
  posture: 'prepare_offer' | 'complete_diligence' | 'hold' | 'blocked'
  headline: string
  clientMessage: string
  operatorNextSteps: string[]
  requiredDocuments: string[]
  revenueOpportunity: {
    key: 'success_fee' | 'diligence_package' | 'monitoring_retainer' | 'legal_cleanup'
    label: string
    rationale: string
  }
}

export type LiquidityAdvisory = {
  readiness: {
    status: LiquidityReadiness
    score: number
    label: string
    summary: string
  }
  checklist: LiquidityChecklistItem[]
  channels: LiquidityChannel[]
  insights: string[]
  clientAdvisory: ClientAdvisory
  assumptions: {
    version: 'liquidity-advisory-v1'
    directAgreementDiscountRate: number
    bridgeLoanAdvanceRate: number
    bridgeLoanAnnualCostRate: number
  }
}

class LiquidityAdvisoryService {
  evaluate(opportunity: OpportunityProjection): LiquidityAdvisory {
    const checklist = buildChecklist(opportunity)
    const readiness = buildReadiness(opportunity, checklist)
    const channels = buildChannels(opportunity, readiness)

    return {
      readiness,
      checklist,
      channels,
      insights: buildInsights(opportunity, readiness, channels),
      clientAdvisory: buildClientAdvisory(readiness, checklist, channels),
      assumptions: {
        version: 'liquidity-advisory-v1',
        directAgreementDiscountRate: 0.4,
        bridgeLoanAdvanceRate: 0.5,
        bridgeLoanAnnualCostRate: 0.24,
      },
    }
  }
}

function buildChecklist(opportunity: OpportunityProjection): LiquidityChecklistItem[] {
  const signalCodes = signalCodeSet(opportunity)

  return [
    {
      key: 'cession_chain',
      label: 'Cadeia de cessões',
      status: signalCodes.has('prior_cession_detected') ? 'blocked' : 'passed',
      reason: signalCodes.has('prior_cession_detected')
        ? 'Foi detectada cessão anterior.'
        : 'Nenhuma cessão anterior apareceu nos sinais monitorados.',
      action: signalCodes.has('prior_cession_detected')
        ? 'Validar escritura, registro no tribunal e posição do cessionário atual.'
        : 'Manter busca ativa em DJEN e registros do tribunal.',
    },
    {
      key: 'encumbrances',
      label: 'Penhoras e bloqueios',
      status: signalCodes.has('lien_detected') ? 'review' : 'passed',
      reason: signalCodes.has('lien_detected')
        ? 'Há sinal de penhora ou constrição sobre o crédito.'
        : 'Sem penhora conhecida nos eventos classificados.',
      action: signalCodes.has('lien_detected')
        ? 'Calcular valor líquido cedível antes de qualquer oferta.'
        : 'Confirmar CVLD antes da assinatura.',
    },
    {
      key: 'procedural_risk',
      label: 'Risco processual',
      status: proceduralStatus(signalCodes, opportunity),
      reason: proceduralReason(signalCodes, opportunity),
      action: proceduralAction(signalCodes, opportunity),
    },
    {
      key: 'ownership_capacity',
      label: 'Titularidade e capacidade',
      status: signalCodes.has('beneficiary_inventory_pending') ? 'blocked' : 'passed',
      reason: signalCodes.has('beneficiary_inventory_pending')
        ? 'Inventário ou sucessão pode impedir assinatura limpa.'
        : 'Sem trava sucessória detectada.',
      action: signalCodes.has('beneficiary_inventory_pending')
        ? 'Resolver representação e documentos sucessórios antes de negociar.'
        : 'Coletar documentos do beneficiário e procuração atualizada.',
    },
    {
      key: 'attorney_fees',
      label: 'Honorários destacados',
      status: signalCodes.has('fee_dispute_detected') ? 'review' : 'passed',
      reason: signalCodes.has('fee_dispute_detected')
        ? 'Há sinal de disputa ou incerteza sobre honorários.'
        : 'Sem disputa de honorários classificada.',
      action: signalCodes.has('fee_dispute_detected')
        ? 'Separar honorários contratuais/sucumbenciais do valor cedível.'
        : 'Confirmar reserva ou destaque no tribunal.',
    },
    {
      key: 'payment_window',
      label: 'Janela de liquidez',
      status: hasPositiveExitSignal(opportunity) ? 'passed' : 'review',
      reason: hasPositiveExitSignal(opportunity)
        ? 'Há evento positivo de saída ou aceleração.'
        : 'Ainda falta um gatilho claro de saída.',
      action: hasPositiveExitSignal(opportunity)
        ? 'Priorizar abordagem comercial e dossiê para comprador.'
        : 'Monitorar acordo direto, superpreferência e pagamento disponibilizado.',
    },
  ]
}

function buildReadiness(
  opportunity: OpportunityProjection,
  checklist: LiquidityChecklistItem[]
): LiquidityAdvisory['readiness'] {
  const blocked = checklist.filter((item) => item.status === 'blocked').length
  const review = checklist.filter((item) => item.status === 'review').length
  const positiveSignals = opportunity.signals.positive.length
  const negativeSignals = opportunity.signals.negative.length
  const baseScore = 72 + positiveSignals * 6 - negativeSignals * 12 - review * 8 - blocked * 35
  const score = clamp(Math.round(baseScore), 0, 100)

  if (blocked > 0 || score < 45) {
    return {
      status: 'blocked',
      score,
      label: 'Bloqueado para oferta',
      summary: 'Existe trava relevante antes de apresentar o ativo a comprador ou financiar.',
    }
  }

  if (score < 78 || review > 0) {
    return {
      status: 'review',
      score,
      label: 'Precisa de diligência',
      summary: 'Há liquidez possível, mas a oferta depende de confirmação documental.',
    }
  }

  return {
    status: 'ready',
    score,
    label: 'Pronto para liquidez',
    summary: 'O ativo tem sinal suficiente para simular oferta e montar dossiê comercial.',
  }
}

function buildChannels(
  opportunity: OpportunityProjection,
  readiness: LiquidityAdvisory['readiness']
): LiquidityChannel[] {
  const pricing = opportunity.pricing
  const faceValue = pricing.faceValue
  const directAgreementOpen = hasSignal(opportunity.signals.positive, 'direct_agreement_opened')
  const paymentAvailable = hasSignal(opportunity.signals.positive, 'payment_available')
  const superpreference = hasSignal(opportunity.signals.positive, 'superpreference_granted')
  const blocked = readiness.status === 'blocked'
  const privateCessionFit = clamp(
    readiness.score + pricing.finalScore * 20 + (paymentAvailable ? 8 : 0),
    0,
    100
  )
  const directAgreementFit = clamp(
    readiness.score + (directAgreementOpen ? 24 : -12) + (superpreference ? 8 : 0),
    0,
    100
  )
  const holdFit = clamp(55 + pricing.paymentProbability * 30 - pricing.termMonths / 3, 0, 100)
  const bridgeLoanFit = clamp(
    readiness.score - 12 + (pricing.paymentProbability > 0.75 ? 10 : -10),
    0,
    100
  )

  const channels: LiquidityChannel[] = [
    {
      key: 'private_cession',
      title: 'Venda com cessão de crédito',
      fitScore: blocked ? 0 : Math.round(privateCessionFit),
      recommended: false,
      value: pricing.acquisitionCost,
      termMonths: pricing.termMonths,
      annualRate: pricing.riskAdjustedIrr,
      rationale: 'Transforma o crédito em caixa agora, com desconto precificado pelo risco.',
      nextAction:
        readiness.status === 'ready'
          ? 'Enviar dossiê para compradores qualificados.'
          : 'Fechar pendências do checklist antes de circular a oportunidade.',
    },
    {
      key: 'direct_agreement',
      title: 'Acordo direto com o ente',
      fitScore: blocked ? 0 : Math.round(directAgreementFit),
      recommended: false,
      value: roundMoney(faceValue * 0.6),
      termMonths: directAgreementOpen ? 12 : 24,
      annualRate: null,
      rationale: directAgreementOpen
        ? 'Há sinal de janela aberta para acordo direto.'
        : 'Pode ser melhor que venda privada se o ente abrir edital.',
      nextAction: directAgreementOpen
        ? 'Checar edital, prazo de adesão e percentual de deságio.'
        : 'Monitorar editais do devedor e regras de habilitação.',
    },
    {
      key: 'hold_and_wait',
      title: 'Esperar a fila',
      fitScore: Math.round(holdFit),
      recommended: false,
      value: pricing.expectedPayment,
      termMonths: pricing.termMonths,
      annualRate: pricing.annualCorrectionRate,
      rationale: 'Preserva valor econômico, mas mantém risco de prazo e liquidez baixa.',
      nextAction: 'Comparar custo de oportunidade com CDI e necessidade de caixa do cliente.',
    },
    {
      key: 'bridge_loan',
      title: 'Antecipação via empréstimo ponte',
      fitScore: blocked ? 0 : Math.round(bridgeLoanFit),
      recommended: false,
      value: roundMoney(faceValue * 0.5),
      termMonths: Math.min(Math.max(pricing.termMonths, 6), 36),
      annualRate: 0.24,
      rationale: 'Gera caixa sem vender integralmente, mas exige estrutura jurídica e custo alto.',
      nextAction: 'Só avançar com parecer jurídico, garantia robusta e análise de capacidade.',
    },
  ]

  const best = channels.reduce((selected, channel) =>
    channel.fitScore > selected.fitScore ? channel : selected
  )

  return channels.map((channel) => ({
    ...channel,
    recommended: channel.key === best.key && channel.fitScore >= 55,
  }))
}

function buildInsights(
  opportunity: OpportunityProjection,
  readiness: LiquidityAdvisory['readiness'],
  channels: LiquidityChannel[]
) {
  const insights: string[] = []
  const recommended = channels.find((channel) => channel.recommended)

  if (readiness.status === 'blocked') {
    insights.push('Não apresente para comprador antes de resolver as travas impeditivas.')
  }

  if (recommended) {
    insights.push(`Melhor caminho agora: ${recommended.title}.`)
  }

  if (opportunity.pricing.riskAdjustedIrr >= 0.25 && readiness.status !== 'blocked') {
    insights.push('A TIR ajustada sustenta abordagem comercial prioritária.')
  }

  if (hasSignal(opportunity.signals.positive, 'payment_available')) {
    insights.push('Pagamento disponibilizado reduz prazo percebido e melhora negociação.')
  }

  if (hasSignal(opportunity.signals.negative, 'lien_detected')) {
    insights.push(
      'Calcule valor líquido cedível; oferta sobre valor bruto pode superestimar caixa.'
    )
  }

  return insights.slice(0, 5)
}

function buildClientAdvisory(
  readiness: LiquidityAdvisory['readiness'],
  checklist: LiquidityChecklistItem[],
  channels: LiquidityChannel[]
): ClientAdvisory {
  const recommended = channels.find((channel) => channel.recommended)
  const blockedItems = checklist.filter((item) => item.status === 'blocked')
  const reviewItems = checklist.filter((item) => item.status === 'review')
  const requiredDocuments = [
    'Documento e procuração atualizada do beneficiário',
    'Certidão de titularidade e dados bancários',
    'Cópia do ofício requisitório e cálculo homologado',
    'Consulta de cessões, penhoras e honorários destacados',
  ]

  if (readiness.status === 'blocked') {
    return {
      posture: 'blocked',
      headline: 'Regularizar antes de falar em venda',
      clientMessage:
        'Neste momento o melhor serviço é limpar a trava jurídica. Uma oferta agora tende a sair pior ou nem avançar.',
      operatorNextSteps: blockedItems.map((item) => item.action).slice(0, 3),
      requiredDocuments,
      revenueOpportunity: {
        key: 'legal_cleanup',
        label: 'Projeto de regularização',
        rationale: 'Há trava impeditiva que exige atuação jurídica antes de liquidez.',
      },
    }
  }

  if (readiness.status === 'review') {
    return {
      posture: 'complete_diligence',
      headline: 'Montar dossiê antes de ofertar',
      clientMessage:
        'Existe possibilidade de liquidez, mas a proposta só deve ser apresentada após confirmar o valor líquido e as pendências.',
      operatorNextSteps: reviewItems.map((item) => item.action).slice(0, 3),
      requiredDocuments,
      revenueOpportunity: {
        key: 'diligence_package',
        label: 'Dossiê de liquidez',
        rationale: 'O escritório pode cobrar pela organização documental e validação pré-oferta.',
      },
    }
  }

  if (recommended?.key === 'hold_and_wait') {
    return {
      posture: 'hold',
      headline: 'Esperar pode preservar mais valor',
      clientMessage:
        'A venda imediata não parece ser o melhor caminho econômico agora. O ganho está em monitorar eventos que acelerem a fila.',
      operatorNextSteps: [
        'Registrar tese de espera e custo de oportunidade.',
        'Configurar monitoramento de acordo direto, pagamento e superpreferência.',
        'Reavaliar proposta quando houver novo evento relevante.',
      ],
      requiredDocuments,
      revenueOpportunity: {
        key: 'monitoring_retainer',
        label: 'Acompanhamento recorrente',
        rationale: 'O valor está em monitorar gatilhos de liquidez e reprecificar o ativo.',
      },
    }
  }

  return {
    posture: 'prepare_offer',
    headline: 'Preparar proposta e comprador qualificado',
    clientMessage:
      'O ativo tem sinais suficientes para iniciar uma conversa de liquidez com tese objetiva e faixa de preço defensável.',
    operatorNextSteps: [
      recommended?.nextAction ?? 'Enviar dossiê para compradores qualificados.',
      'Validar valor líquido cedível antes de apresentar preço final.',
      'Registrar faixa mínima aceitável e prazo de decisão do cliente.',
    ],
    requiredDocuments,
    revenueOpportunity: {
      key: 'success_fee',
      label: 'Originação com success fee',
      rationale: 'O escritório pode capturar valor conectando ativo validado a comprador ou FIDC.',
    },
  }
}

function proceduralStatus(signalCodes: Set<string>, opportunity: OpportunityProjection) {
  if (signalCodes.has('suspension_detected')) {
    return 'blocked'
  }

  if (signalCodes.has('objection_pending') || opportunity.asset.lifecycleStatus === 'suspended') {
    return 'review'
  }

  return 'passed'
}

function proceduralReason(signalCodes: Set<string>, opportunity: OpportunityProjection) {
  if (signalCodes.has('suspension_detected') || opportunity.asset.lifecycleStatus === 'suspended') {
    return 'Há suspensão que pode interromper pagamento ou cessão.'
  }

  if (signalCodes.has('objection_pending')) {
    return 'Há impugnação ou embargos pendentes.'
  }

  return 'Sem suspensão ou impugnação classificada.'
}

function proceduralAction(signalCodes: Set<string>, opportunity: OpportunityProjection) {
  if (signalCodes.has('suspension_detected') || opportunity.asset.lifecycleStatus === 'suspended') {
    return 'Aguardar baixa da suspensão ou parecer jurídico antes de ofertar.'
  }

  if (signalCodes.has('objection_pending')) {
    return 'Confirmar valor incontroverso e risco de redução.'
  }

  return 'Anexar movimentações principais ao dossiê.'
}

function signalCodeSet(opportunity: OpportunityProjection) {
  return new Set(
    [...opportunity.signals.positive, ...opportunity.signals.negative].map((signal) => signal.code)
  )
}

function hasPositiveExitSignal(opportunity: OpportunityProjection) {
  return ['payment_available', 'direct_agreement_opened', 'superpreference_granted'].some((code) =>
    hasSignal(opportunity.signals.positive, code)
  )
}

function hasSignal(signals: EventSignal[], code: string) {
  return signals.some((signal) => signal.code === code)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function roundMoney(value: number) {
  return Number(value.toFixed(2))
}

export const liquidityAdvisoryService = new LiquidityAdvisoryService()
export default liquidityAdvisoryService
