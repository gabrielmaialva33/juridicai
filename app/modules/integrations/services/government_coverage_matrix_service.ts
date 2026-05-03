import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import GovernmentSourceTarget from '#modules/integrations/models/government_source_target'
import type { GovernmentSourceTargetStatus, JsonRecord } from '#shared/types/model_enums'

const STATE_COURTS = [
  ['AC', 'tjac'],
  ['AL', 'tjal'],
  ['AM', 'tjam'],
  ['AP', 'tjap'],
  ['BA', 'tjba'],
  ['CE', 'tjce'],
  ['DF', 'tjdft'],
  ['ES', 'tjes'],
  ['GO', 'tjgo'],
  ['MA', 'tjma'],
  ['MG', 'tjmg'],
  ['MS', 'tjms'],
  ['MT', 'tjmt'],
  ['PA', 'tjpa'],
  ['PB', 'tjpb'],
  ['PE', 'tjpe'],
  ['PI', 'tjpi'],
  ['PR', 'tjpr'],
  ['RJ', 'tjrj'],
  ['RN', 'tjrn'],
  ['RO', 'tjro'],
  ['RR', 'tjrr'],
  ['RS', 'tjrs'],
  ['SC', 'tjsc'],
  ['SE', 'tjse'],
  ['SP', 'tjsp'],
  ['TO', 'tjto'],
] as const

const FEDERAL_COURTS = ['trf1', 'trf2', 'trf3', 'trf4', 'trf5', 'trf6'] as const

export type CoverageLayerStatus = 'validated' | 'configured' | 'mapped' | 'blocked' | 'missing'

export type GovernmentCoverageMatrix = {
  generatedAt: string
  summary: GovernmentCoverageSummary
  federal: FederalCoverageItem[]
  states: StateCoverageItem[]
  gaps: CoverageGap[]
}

export type GovernmentCoverageSummary = {
  statesCount: number
  validatedStatesCount: number
  configuredStatesCount: number
  mappedStatesCount: number
  blockedStatesCount: number
  missingStatesCount: number
  dataJudStatesCount: number
  djenStatesCount: number
  federalPrimaryValidatedCount: number
}

export type StateCoverageItem = {
  stateCode: string
  courtAlias: string
  overallStatus: CoverageLayerStatus
  primary: CoverageLayer
  datajud: CoverageLayer
  djen: CoverageLayer
  intelligence: StateCoverageIntelligence
  nextActions: string[]
}

export type FederalCoverageItem = {
  courtAlias: string
  overallStatus: CoverageLayerStatus
  primary: CoverageLayer
  datajud: CoverageLayer
  djen: CoverageLayer
  nextActions: string[]
}

export type CoverageLayer = {
  status: CoverageLayerStatus
  targetKey: string | null
  targetName: string | null
  adapterKey: string | null
  sourceUrl: string | null
  sourceStatus: GovernmentSourceTargetStatus | null
  lastSuccessAt: string | null
  lastDiscoveredCount: number
  lastSourceRecordsCount: number
  tenantSourceRecordsCount: number
  evidenceScore: number
  metadata: JsonRecord | null
}

export type StateCoverageIntelligence = {
  hasPrimaryDiscovery: boolean
  hasProcessEnrichment: boolean
  hasPublicationSignals: boolean
  hasRealDataEvidence: boolean
  readyForOperationalScoring: boolean
}

export type CoverageGap = {
  level: 'federal' | 'state'
  stateCode: string | null
  courtAlias: string
  severity: 'high' | 'medium' | 'low'
  code: string
  message: string
  recommendedAction: string
}

class GovernmentCoverageMatrixService {
  async build(tenantId: string): Promise<GovernmentCoverageMatrix> {
    const [targets, sourceRecordCounts] = await Promise.all([
      GovernmentSourceTarget.query()
        .where('is_active', true)
        .orderBy('priority', 'asc')
        .orderBy('name', 'asc'),
      db
        .from('source_records')
        .select('source_dataset_id')
        .count('* as records_count')
        .where('tenant_id', tenantId)
        .whereNotNull('source_dataset_id')
        .groupBy('source_dataset_id'),
    ])
    const countsByDataset = new Map(
      sourceRecordCounts.map((row) => [
        String(row.source_dataset_id),
        Number(row.records_count ?? 0),
      ])
    )
    const targetsByCourt = groupTargetsByCourt(targets)
    const states = STATE_COURTS.map(([stateCode, courtAlias]) => {
      const courtTargets = targetsByCourt.get(courtAlias) ?? []
      return this.buildStateItem(stateCode, courtAlias, courtTargets, countsByDataset)
    })
    const federal = FEDERAL_COURTS.map((courtAlias) => {
      const courtTargets = targetsByCourt.get(courtAlias) ?? []
      return this.buildFederalItem(courtAlias, courtTargets, countsByDataset)
    })
    const gaps = [
      ...states.flatMap((state) => state.nextActionsToGaps()),
      ...federal.flatMap((item) => item.nextActionsToGaps()),
    ]

    return {
      generatedAt: DateTime.now().toISO(),
      summary: summarize(states, federal),
      federal: federal.map(stripGapHelper),
      states: states.map(stripGapHelper),
      gaps,
    }
  }

  private buildStateItem(
    stateCode: string,
    courtAlias: string,
    targets: GovernmentSourceTarget[],
    countsByDataset: Map<string, number>
  ) {
    const primary = buildLayer(selectPrimaryTarget(targets), countsByDataset)
    const datajud = buildLayer(selectTargetBySource(targets, 'datajud'), countsByDataset)
    const djen = buildLayer(selectTargetBySource(targets, 'djen'), countsByDataset)
    const intelligence = buildStateIntelligence(primary, datajud, djen)
    const overallStatus = weakestStatus([primary.status, datajud.status, djen.status])
    const nextActions = stateNextActions({
      stateCode,
      courtAlias,
      primary,
      datajud,
      djen,
      intelligence,
    })

    return {
      stateCode,
      courtAlias,
      overallStatus,
      primary,
      datajud,
      djen,
      intelligence,
      nextActions,
      nextActionsToGaps: () =>
        stateGaps({ stateCode, courtAlias, primary, datajud, djen, intelligence }),
    }
  }

  private buildFederalItem(
    courtAlias: string,
    targets: GovernmentSourceTarget[],
    countsByDataset: Map<string, number>
  ) {
    const primary = buildLayer(selectPrimaryTarget(targets), countsByDataset)
    const datajud = buildLayer(selectTargetBySource(targets, 'datajud'), countsByDataset)
    const djen = buildLayer(selectTargetBySource(targets, 'djen'), countsByDataset)
    const overallStatus = weakestStatus([primary.status, datajud.status, djen.status])
    const nextActions = federalNextActions({ courtAlias, primary, datajud, djen })

    return {
      courtAlias,
      overallStatus,
      primary,
      datajud,
      djen,
      nextActions,
      nextActionsToGaps: () => federalGaps({ courtAlias, primary, datajud, djen }),
    }
  }
}

function groupTargetsByCourt(targets: GovernmentSourceTarget[]) {
  const groups = new Map<string, GovernmentSourceTarget[]>()

  for (const target of targets) {
    if (!target.courtAlias) {
      continue
    }

    const courtAlias = target.courtAlias.toLowerCase()
    groups.set(courtAlias, [...(groups.get(courtAlias) ?? []), target])
  }

  return groups
}

function selectPrimaryTarget(targets: GovernmentSourceTarget[]) {
  const candidates = targets.filter(
    (target) => target.source === 'tribunal' && target.priority === 'primary'
  )

  return candidates.sort((left, right) => targetRank(right) - targetRank(left))[0] ?? null
}

function selectTargetBySource(targets: GovernmentSourceTarget[], source: 'datajud' | 'djen') {
  const candidates = targets.filter((target) => target.source === source)

  return candidates.sort((left, right) => targetRank(right) - targetRank(left))[0] ?? null
}

function buildLayer(
  target: GovernmentSourceTarget | null,
  countsByDataset: Map<string, number>
): CoverageLayer {
  if (!target) {
    return emptyLayer()
  }

  const tenantSourceRecordsCount = countsByDataset.get(target.sourceDatasetId) ?? 0
  const evidenceScore =
    (target.lastSuccessAt ? 2 : 0) +
    Math.min(target.lastDiscoveredCount, 100) / 100 +
    Math.min(target.lastSourceRecordsCount + tenantSourceRecordsCount, 100) / 50

  return {
    status: resolveLayerStatus(target, tenantSourceRecordsCount),
    targetKey: target.key,
    targetName: target.name,
    adapterKey: target.adapterKey,
    sourceUrl: target.sourceUrl,
    sourceStatus: target.status,
    lastSuccessAt: target.lastSuccessAt?.toISO() ?? null,
    lastDiscoveredCount: target.lastDiscoveredCount,
    lastSourceRecordsCount: target.lastSourceRecordsCount,
    tenantSourceRecordsCount,
    evidenceScore,
    metadata: target.metadata,
  }
}

function emptyLayer(): CoverageLayer {
  return {
    status: 'missing',
    targetKey: null,
    targetName: null,
    adapterKey: null,
    sourceUrl: null,
    sourceStatus: null,
    lastSuccessAt: null,
    lastDiscoveredCount: 0,
    lastSourceRecordsCount: 0,
    tenantSourceRecordsCount: 0,
    evidenceScore: 0,
    metadata: null,
  }
}

function resolveLayerStatus(
  target: GovernmentSourceTarget,
  tenantSourceRecordsCount: number
): CoverageLayerStatus {
  if (target.status === 'blocked_captcha') {
    return 'blocked'
  }

  const runnable =
    ['implemented', 'generic_supported'].includes(target.status) && Boolean(target.adapterKey)
  const hasEvidence =
    Boolean(target.lastSuccessAt) ||
    target.lastDiscoveredCount > 0 ||
    target.lastSourceRecordsCount > 0 ||
    tenantSourceRecordsCount > 0

  if (runnable && hasEvidence) {
    return 'validated'
  }

  if (runnable) {
    return 'configured'
  }

  if (target.sourceUrl) {
    return 'mapped'
  }

  return 'missing'
}

function targetRank(target: GovernmentSourceTarget) {
  return (
    statusRank(resolveLayerStatus(target, 0)) * 1000 +
    (target.adapterKey ? 100 : 0) +
    (target.sourceUrl ? 10 : 0) +
    target.lastSourceRecordsCount +
    target.lastDiscoveredCount
  )
}

function weakestStatus(statuses: CoverageLayerStatus[]) {
  return statuses.sort((left, right) => statusRank(left) - statusRank(right))[0] ?? 'missing'
}

function statusRank(status: CoverageLayerStatus) {
  const ranks: Record<CoverageLayerStatus, number> = {
    missing: 0,
    blocked: 1,
    mapped: 2,
    configured: 3,
    validated: 4,
  }

  return ranks[status]
}

function buildStateIntelligence(
  primary: CoverageLayer,
  datajud: CoverageLayer,
  djen: CoverageLayer
): StateCoverageIntelligence {
  const hasPrimaryDiscovery = ['validated', 'configured'].includes(primary.status)
  const hasProcessEnrichment = ['validated', 'configured'].includes(datajud.status)
  const hasPublicationSignals = ['validated', 'configured'].includes(djen.status)
  const hasRealDataEvidence = [primary, datajud, djen].some((layer) => layer.status === 'validated')

  return {
    hasPrimaryDiscovery,
    hasProcessEnrichment,
    hasPublicationSignals,
    hasRealDataEvidence,
    readyForOperationalScoring:
      hasPrimaryDiscovery && hasProcessEnrichment && hasPublicationSignals,
  }
}

function stateNextActions(input: {
  stateCode: string
  courtAlias: string
  primary: CoverageLayer
  datajud: CoverageLayer
  djen: CoverageLayer
  intelligence: StateCoverageIntelligence
}) {
  return stateGaps(input).map((gap) => gap.recommendedAction)
}

function federalNextActions(input: {
  courtAlias: string
  primary: CoverageLayer
  datajud: CoverageLayer
  djen: CoverageLayer
}) {
  return federalGaps(input).map((gap) => gap.recommendedAction)
}

function stateGaps(input: {
  stateCode: string
  courtAlias: string
  primary: CoverageLayer
  datajud: CoverageLayer
  djen: CoverageLayer
  intelligence: StateCoverageIntelligence
}): CoverageGap[] {
  const gaps: CoverageGap[] = []

  if (input.primary.status === 'missing') {
    gaps.push({
      level: 'state',
      stateCode: input.stateCode,
      courtAlias: input.courtAlias,
      severity: 'high',
      code: 'primary_source_missing',
      message: `${input.courtAlias.toUpperCase()} has no runnable public precatorio source configured.`,
      recommendedAction: `Research and configure the official ${input.stateCode} court precatorio list, map or API source.`,
    })
  } else if (input.primary.status === 'mapped') {
    gaps.push({
      level: 'state',
      stateCode: input.stateCode,
      courtAlias: input.courtAlias,
      severity: 'medium',
      code: 'primary_source_mapped_without_adapter',
      message: `${input.courtAlias.toUpperCase()} has a public source URL but no runnable adapter.`,
      recommendedAction: `Promote ${input.courtAlias.toUpperCase()} to a generic or dedicated tribunal adapter.`,
    })
  } else if (input.primary.status === 'configured') {
    gaps.push({
      level: 'state',
      stateCode: input.stateCode,
      courtAlias: input.courtAlias,
      severity: 'medium',
      code: 'primary_source_not_validated',
      message: `${input.courtAlias.toUpperCase()} is configured but has no successful collection evidence yet.`,
      recommendedAction: `Run tribunal sync for ${input.courtAlias.toUpperCase()} and inspect imported rows.`,
    })
  }

  if (input.datajud.status === 'missing') {
    gaps.push({
      level: 'state',
      stateCode: input.stateCode,
      courtAlias: input.courtAlias,
      severity: 'medium',
      code: 'datajud_missing',
      message: `${input.courtAlias.toUpperCase()} has no DataJud enrichment target.`,
      recommendedAction: `Configure DataJud process enrichment for ${input.courtAlias.toUpperCase()}.`,
    })
  }

  if (input.djen.status === 'missing') {
    gaps.push({
      level: 'state',
      stateCode: input.stateCode,
      courtAlias: input.courtAlias,
      severity: 'medium',
      code: 'djen_missing',
      message: `${input.courtAlias.toUpperCase()} has no DJEN publication target.`,
      recommendedAction: `Configure DJEN publication monitoring for ${input.courtAlias.toUpperCase()}.`,
    })
  }

  if (!input.intelligence.readyForOperationalScoring) {
    gaps.push({
      level: 'state',
      stateCode: input.stateCode,
      courtAlias: input.courtAlias,
      severity: 'low',
      code: 'operational_scoring_incomplete',
      message: `${input.courtAlias.toUpperCase()} does not have all discovery, process and publication layers ready.`,
      recommendedAction: `Complete primary discovery, DataJud and DJEN layers before treating ${input.stateCode} as operationally complete.`,
    })
  }

  return gaps
}

function federalGaps(input: {
  courtAlias: string
  primary: CoverageLayer
  datajud: CoverageLayer
  djen: CoverageLayer
}): CoverageGap[] {
  const gaps: CoverageGap[] = []

  if (input.primary.status !== 'validated') {
    gaps.push({
      level: 'federal',
      stateCode: null,
      courtAlias: input.courtAlias,
      severity: input.primary.status === 'missing' ? 'high' : 'medium',
      code: 'federal_primary_not_validated',
      message: `${input.courtAlias.toUpperCase()} public precatorio reports are not validated with real collection evidence.`,
      recommendedAction: `Run federal tribunal sync for ${input.courtAlias.toUpperCase()} and confirm imported assets.`,
    })
  }

  if (input.datajud.status === 'missing') {
    gaps.push({
      level: 'federal',
      stateCode: null,
      courtAlias: input.courtAlias,
      severity: 'medium',
      code: 'federal_datajud_missing',
      message: `${input.courtAlias.toUpperCase()} has no DataJud target.`,
      recommendedAction: `Configure DataJud enrichment for ${input.courtAlias.toUpperCase()}.`,
    })
  }

  if (input.djen.status === 'missing') {
    gaps.push({
      level: 'federal',
      stateCode: null,
      courtAlias: input.courtAlias,
      severity: 'medium',
      code: 'federal_djen_missing',
      message: `${input.courtAlias.toUpperCase()} has no DJEN target.`,
      recommendedAction: `Configure DJEN publication monitoring for ${input.courtAlias.toUpperCase()}.`,
    })
  }

  return gaps
}

function summarize(
  states: Array<StateCoverageItem & { nextActionsToGaps: () => CoverageGap[] }>,
  federal: Array<FederalCoverageItem & { nextActionsToGaps: () => CoverageGap[] }>
): GovernmentCoverageSummary {
  return {
    statesCount: states.length,
    validatedStatesCount: states.filter((state) => state.primary.status === 'validated').length,
    configuredStatesCount: states.filter((state) => state.primary.status === 'configured').length,
    mappedStatesCount: states.filter((state) => state.primary.status === 'mapped').length,
    blockedStatesCount: states.filter((state) => state.primary.status === 'blocked').length,
    missingStatesCount: states.filter((state) => state.primary.status === 'missing').length,
    dataJudStatesCount: states.filter((state) => state.datajud.status !== 'missing').length,
    djenStatesCount: states.filter((state) => state.djen.status !== 'missing').length,
    federalPrimaryValidatedCount: federal.filter((item) => item.primary.status === 'validated')
      .length,
  }
}

function stripGapHelper<T extends { nextActionsToGaps: () => CoverageGap[] }>(
  item: T
): Omit<T, 'nextActionsToGaps'> {
  const { nextActionsToGaps: omittedGapHelper, ...payload } = item
  void omittedGapHelper

  return payload
}

export default new GovernmentCoverageMatrixService()
