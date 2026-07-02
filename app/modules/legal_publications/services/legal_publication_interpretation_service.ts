import { DateTime } from 'luxon'
import type LegalPublication from '#modules/legal_publications/models/legal_publication'
import { type DeadlineKind } from '#modules/legal_publications/models/legal_publication'
import legalPublicationRepository from '#modules/legal_publications/repositories/legal_publication_repository'
import legalPublicationEventRepository from '#modules/legal_publications/repositories/legal_publication_event_repository'

type LegalBranch = 'civil' | 'small_claims' | 'federal' | 'federal_small_claims' | 'labor' | null
type LegalActType =
  | 'citation'
  | 'sentence'
  | 'embargos_decision'
  | 'appellate_decision'
  | 'article_523_notice'
  | 'interlocutory_decision'
  | 'compliance_challenge'
  | 'order'
  | 'monocratic_decision'
  | 'judgment_docket'
  | 'counterarguments'
  | 'suspension'
  | 'extrajudicial_execution'
  | 'attachment'
  | 'case_return'
  | 'court_costs'
  | 'other'
  | null

type Priority = 'high' | 'medium' | 'low'
type Confidence = 'high' | 'low'

export type LegalPublicationInterpretationResult = {
  determination: string | null
  branch: LegalBranch
  actType: LegalActType
  recommendedAction: string | null
  legalBasis: string | null
  deadlineDays: number | null
  deadlineKind: DeadlineKind | null
  labels: string[] | null
  hearingAt: DateTime | null
  hearingTime: string | null
  judgmentAt: DateTime | null
  priority: Priority
  confidence: Confidence
  notes: string | null
  manualReviewRequired: boolean
  validatorFailed: boolean
  validatorReason: string | null
  deadlineReason: string | null
  processedAt: DateTime
}

const FATAL_ACT_TYPES = new Set<LegalActType>([
  'citation',
  'sentence',
  'embargos_decision',
  'appellate_decision',
  'article_523_notice',
  'interlocutory_decision',
  'compliance_challenge',
  'monocratic_decision',
  'judgment_docket',
  'counterarguments',
  'extrajudicial_execution',
  'attachment',
  'case_return',
  'court_costs',
])

class LegalPublicationInterpretationService {
  async interpretAndPersist(publication: LegalPublication) {
    const interpretation = interpretLegalPublication({
      text: publication.body,
      courtAlias: publication.courtAlias,
      communicationType: publication.communicationType,
      judicialClass: publication.judicialClass,
    })

    await legalPublicationRepository.applyInterpretation(publication, interpretation)
    await legalPublicationEventRepository.createEvent(publication.tenantId, {
      legalPublicationId: publication.id,
      eventType: 'interpreted',
      payload: {
        branch: interpretation.branch,
        actType: interpretation.actType,
        deadlineDays: interpretation.deadlineDays,
        deadlineKind: interpretation.deadlineKind,
        priority: interpretation.priority,
        confidence: interpretation.confidence,
        validatorFailed: interpretation.validatorFailed,
        validatorReason: interpretation.validatorReason,
      },
    })

    return interpretation
  }
}

export function interpretLegalPublication(input: {
  text: string
  courtAlias?: string | null
  communicationType?: string | null
  judicialClass?: string | null
}): LegalPublicationInterpretationResult {
  const normalizedText = normalizeText(input.text)
  const branch = detectBranch(input.courtAlias, normalizedText, input.judicialClass)
  const actType = detectActType(normalizedText, input.communicationType)
  const explicitDeadline = extractExplicitDeadline(normalizedText)
  const canonicalDeadline = explicitDeadline ?? canonicalDeadlineFor(actType, branch)
  const hearing = extractDatedEvent(normalizedText, 'hearing')
  const judgment = extractDatedEvent(normalizedText, 'judgment')
  const manifestWithoutDeadline = hasManifestationWithoutDeadline(normalizedText, explicitDeadline)
  const deadline =
    canonicalDeadline ??
    (manifestWithoutDeadline ? ({ days: 5, kind: 'business_days' } as const) : null)
  const labels = buildLabels({ normalizedText, branch, actType, hearingAt: hearing.date })
  const validatorReasons = validateInterpretation({
    actType,
    deadline,
    explicitDeadline,
    manifestWithoutDeadline,
    normalizedText,
  })

  return {
    determination: summarizeDetermination(actType, explicitDeadline, manifestWithoutDeadline),
    branch,
    actType,
    recommendedAction: recommendedActionFor(actType, deadline),
    legalBasis: legalBasisFor(actType, branch, manifestWithoutDeadline),
    deadlineDays: deadline?.days ?? null,
    deadlineKind: deadline?.kind ?? null,
    labels: labels.length ? labels : null,
    hearingAt: hearing.date,
    hearingTime: hearing.time,
    judgmentAt: judgment.date,
    priority: priorityFor({ actType, normalizedText, deadline }),
    confidence: confidenceFor({ actType, deadline, explicitDeadline, validatorReasons }),
    notes: null,
    manualReviewRequired: validatorReasons.length > 0,
    validatorFailed: validatorReasons.length > 0,
    validatorReason: validatorReasons.length ? validatorReasons.join('; ') : null,
    deadlineReason: manifestWithoutDeadline
      ? 'manifestation_without_explicit_deadline_assumed_five_business_days'
      : null,
    processedAt: DateTime.utc(),
  }
}

function detectBranch(
  courtAlias: string | null | undefined,
  normalizedText: string,
  judicialClass: string | null | undefined
): LegalBranch {
  if (/\b(jec|juizado especial civel)\b/.test(normalizedText)) {
    return 'small_claims'
  }

  if (/\b(jef|juizado especial federal)\b/.test(normalizedText)) {
    return 'federal_small_claims'
  }

  const court = courtAlias?.toUpperCase() ?? ''

  if (court === 'TST' || court.startsWith('TRT')) {
    return 'labor'
  }

  if (court.startsWith('TRF')) {
    return /juizado especial/i.test(judicialClass ?? '') ? 'federal_small_claims' : 'federal'
  }

  if (court.startsWith('TJ')) {
    return /juizado especial/i.test(judicialClass ?? '') ? 'small_claims' : 'civil'
  }

  return null
}

function detectActType(
  normalizedText: string,
  communicationType: string | null | undefined
): LegalActType {
  const communication = normalizeText(communicationType ?? '')

  if (/\bcitacao\b|\bcite-se\b|\bcitado\b|\bcitada\b/.test(normalizedText)) return 'citation'
  if (/\bart\.?\s*523\b|artigo\s*523|cumprimento\s+de\s+sentenca/.test(normalizedText)) {
    return 'article_523_notice'
  }
  if (/\bimpugnacao\s+ao\s+cumprimento|\bimpugnar\s+o\s+cumprimento/.test(normalizedText)) {
    return 'compliance_challenge'
  }
  if (/\bexecucao\s+de\s+titulo\s+extrajudicial|\bembargos\s+a\s+execucao/.test(normalizedText)) {
    return 'extrajudicial_execution'
  }
  if (/\bpenhora\b|\bbloqueio\b|\bbacenjud\b|\bsisbajud\b/.test(normalizedText)) {
    return 'attachment'
  }
  if (/\bacordao\b|\bacordam\b|\bturma\s+recursal\b/.test(normalizedText)) {
    return 'appellate_decision'
  }
  if (/\bdecisao\s+monocratica\b|\bdecisao\s+do\s+relator\b/.test(normalizedText)) {
    return 'monocratic_decision'
  }
  if (/\bembargos\s+de\s+declaracao\b|\bed\b/.test(normalizedText)) return 'embargos_decision'
  if (/\bsentenca\b|\bjulgo\s+(procedente|improcedente)|dispositivo\b/.test(normalizedText)) {
    return 'sentence'
  }
  if (/\bpauta\s+de\s+julgamento\b|\bsessao\s+de\s+julgamento\b/.test(normalizedText)) {
    return 'judgment_docket'
  }
  if (/\bcontrarrazoes\b|\bcontra-razoes\b/.test(normalizedText)) return 'counterarguments'
  if (/\bsuspensao\b|\bsuspenso\b|\bsuspender\b/.test(normalizedText)) return 'suspension'
  if (
    /\bretorno\s+dos\s+autos\b|\bbaixa\s+dos\s+autos\b|\bdescida\s+dos\s+autos\b/.test(
      normalizedText
    )
  ) {
    return 'case_return'
  }
  if (/\bcustas\b|\bpreparo\b|\brecolhimento\b/.test(normalizedText)) return 'court_costs'
  if (
    /\bdecisao\b|\bdefiro\b|\bindefiro\b|\bhomologo\b|\brejeito\b|\bacolho\b/.test(normalizedText)
  ) {
    return 'interlocutory_decision'
  }
  if (
    communication.includes('intimacao') ||
    /\bintime-se\b|\bmanifeste-se\b/.test(normalizedText)
  ) {
    return 'order'
  }

  return 'other'
}

function extractExplicitDeadline(normalizedText: string) {
  const match = normalizedText.match(
    /\bprazo\s+(?:de\s+)?(?<days>\d{1,3}|cinco|dez|quinze|oito)\s+dias?\s*(?<kind>uteis|corridos)?/
  )

  if (!match?.groups) {
    return null
  }

  const days = numberFromDeadlineToken(match.groups.days)

  if (!days) {
    return null
  }

  return {
    days,
    kind:
      match.groups.kind === 'corridos' ? ('calendar_days' as const) : ('business_days' as const),
  }
}

function canonicalDeadlineFor(actType: LegalActType, branch: LegalBranch) {
  if (!actType) {
    return null
  }

  if (
    branch === 'labor' &&
    ['sentence', 'embargos_decision', 'appellate_decision'].includes(actType)
  ) {
    return { days: 8, kind: 'business_days' as const }
  }

  if (branch === 'small_claims' || branch === 'federal_small_claims') {
    if (actType === 'citation' || actType === 'sentence' || actType === 'embargos_decision') {
      return { days: 10, kind: 'business_days' as const }
    }
  }

  if (
    [
      'citation',
      'sentence',
      'embargos_decision',
      'appellate_decision',
      'article_523_notice',
      'interlocutory_decision',
      'compliance_challenge',
      'monocratic_decision',
      'counterarguments',
      'extrajudicial_execution',
    ].includes(actType)
  ) {
    return { days: 15, kind: 'business_days' as const }
  }

  if (actType === 'case_return') {
    return { days: 10, kind: 'business_days' as const }
  }

  return null
}

function extractDatedEvent(normalizedText: string, event: 'hearing' | 'judgment') {
  const eventPattern =
    event === 'hearing' ? '(?:audiencia|conciliacao|instrucao)' : '(?:julgamento|sessao)'
  const match = normalizedText.match(
    new RegExp(
      `${eventPattern}[\\s\\S]{0,80}(?<date>\\d{2}\\/\\d{2}\\/\\d{4})(?:[\\s\\S]{0,30}?(?<time>\\d{1,2}:\\d{2}))?`,
      'i'
    )
  )

  if (!match?.groups?.date) {
    return { date: null, time: null }
  }

  return {
    date: DateTime.fromFormat(match.groups.date, 'dd/MM/yyyy', { zone: 'utc' }).startOf('day'),
    time: normalizeTime(match.groups.time ?? null),
  }
}

function hasManifestationWithoutDeadline(normalizedText: string, explicitDeadline: unknown) {
  return (
    !explicitDeadline &&
    /\b(manifeste-se|manifestar|manifestacao|pronuncie-se|diga)\b/.test(normalizedText)
  )
}

function validateInterpretation(input: {
  actType: LegalActType
  deadline: { days: number; kind: DeadlineKind } | null
  explicitDeadline: { days: number; kind: DeadlineKind } | null
  manifestWithoutDeadline: boolean
  normalizedText: string
}) {
  const reasons: string[] = []

  if (input.manifestWithoutDeadline) {
    reasons.push('manifestation_without_explicit_deadline')
  }

  if (
    FATAL_ACT_TYPES.has(input.actType) &&
    !input.deadline &&
    input.actType !== 'judgment_docket'
  ) {
    reasons.push('fatal_act_without_deadline')
  }

  if (input.explicitDeadline && input.explicitDeadline.days > 60) {
    reasons.push('unusually_long_deadline')
  }

  if (/\bsem\s+prazo\b|\bprazo\s+nao\s+informado\b/.test(input.normalizedText) && input.deadline) {
    reasons.push('text_denies_deadline_but_deadline_was_detected')
  }

  return reasons
}

function summarizeDetermination(
  actType: LegalActType,
  explicitDeadline: { days: number; kind: DeadlineKind } | null,
  manifestWithoutDeadline: boolean
) {
  if (explicitDeadline) {
    return `Explicit ${explicitDeadline.days}-day deadline detected.`
  }

  if (manifestWithoutDeadline) {
    return 'Manifestation requested without explicit deadline; default review deadline applied.'
  }

  switch (actType) {
    case 'citation':
      return 'Citation detected.'
    case 'sentence':
      return 'Sentence detected.'
    case 'article_523_notice':
      return 'Article 523 compliance notice detected.'
    case 'judgment_docket':
      return 'Judgment docket detected.'
    case 'order':
      return 'Procedural order detected.'
    default:
      return null
  }
}

function recommendedActionFor(
  actType: LegalActType,
  deadline: { days: number; kind: DeadlineKind } | null
) {
  if (deadline) {
    return 'Review and calendar the deadline.'
  }

  if (actType === 'judgment_docket') {
    return 'Review hearing or judgment date.'
  }

  return 'Review publication.'
}

function legalBasisFor(
  actType: LegalActType,
  branch: LegalBranch,
  manifestWithoutDeadline: boolean
) {
  if (manifestWithoutDeadline) return 'CPC art. 218, paragraph 3'
  if (actType === 'article_523_notice') return 'CPC art. 523'
  if (actType === 'citation') return branch === 'small_claims' ? 'Law 9.099/95' : 'CPC art. 335'
  if (actType === 'sentence' || actType === 'appellate_decision')
    return 'CPC art. 1.003, paragraph 5'
  if (actType === 'interlocutory_decision') return 'CPC art. 1.015'
  if (actType === 'embargos_decision') return 'CPC art. 1.023'
  return null
}

function priorityFor(input: {
  actType: LegalActType
  normalizedText: string
  deadline: { days: number; kind: DeadlineKind } | null
}): Priority {
  if (
    /\burgente\b|\bliminar\b|\btutela\b|\bpenhora\b|\bbloqueio\b/.test(input.normalizedText) ||
    (input.deadline && input.deadline.days <= 5)
  ) {
    return 'high'
  }

  if (FATAL_ACT_TYPES.has(input.actType) || input.deadline) {
    return 'medium'
  }

  return 'low'
}

function confidenceFor(input: {
  actType: LegalActType
  deadline: { days: number; kind: DeadlineKind } | null
  explicitDeadline: { days: number; kind: DeadlineKind } | null
  validatorReasons: string[]
}): Confidence {
  if (input.validatorReasons.length > 0) {
    return 'low'
  }

  if (input.explicitDeadline || (input.actType && input.deadline)) {
    return 'high'
  }

  return 'low'
}

function buildLabels(input: {
  normalizedText: string
  branch: LegalBranch
  actType: LegalActType
  hearingAt: DateTime | null
}) {
  const labels = new Set<string>()

  if (input.branch) labels.add(input.branch)
  if (input.actType) labels.add(input.actType)
  if (input.hearingAt) labels.add('hearing')
  if (/\bprecatorio\b|\brpv\b/.test(input.normalizedText)) labels.add('precatorio')
  if (/\btutela\b|\bliminar\b/.test(input.normalizedText)) labels.add('injunction')
  if (/\bpenhora\b|\bbloqueio\b/.test(input.normalizedText)) labels.add('asset_restriction')

  return [...labels]
}

function numberFromDeadlineToken(token: string) {
  const words: Record<string, number> = {
    cinco: 5,
    oito: 8,
    dez: 10,
    quinze: 15,
  }

  return words[token] ?? Number(token)
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function normalizeTime(value: string | null) {
  if (!value) {
    return null
  }

  const [hour, minute] = value.split(':')
  return `${hour.padStart(2, '0')}:${minute}`
}

export default new LegalPublicationInterpretationService()
