import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import assetIntelligenceActionService, {
  type AssetIntelligenceActionResult,
} from '#modules/operations/services/asset_intelligence_action_service'
import assetIntelligenceDossierService from '#modules/operations/services/asset_intelligence_dossier_service'
import nationalDataCoherenceService, {
  type NationalDataCoherenceReport,
  type NationalDataCoherenceStatus,
} from '#modules/integrations/services/national_data_coherence_service'
import assetFieldEvidenceService from '#modules/precatorios/services/asset_field_evidence_service'
import type { SourceType } from '#shared/types/model_enums'

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 250
const DEFAULT_MAX_ACTIONS_PER_ASSET = 3
const DEFAULT_RECENT_ACTION_COOLDOWN_HOURS = 6

type ReconcileActionPriority = 'high' | 'medium' | 'low'

export type AssetIntelligenceReconcileOptions = {
  tenantId: string
  limit?: number | null
  source?: SourceType | null
  dryRun?: boolean
  highPriorityOnly?: boolean
  includeManualActions?: boolean
  allowAutomationWithConflicts?: boolean
  maxActionsPerAsset?: number | null
  recentActionCooldownHours?: number | null
  useNationalCoherence?: boolean | null
  materializeFieldEvidence?: boolean | null
  requestId?: string | null
}

export type AssetIntelligenceReconcileResult = {
  tenantId: string
  dryRun: boolean
  selectedAssets: number
  inspectedAssets: number
  actedAssets: number
  skippedAssets: number
  failedAssets: number
  queuedActions: number
  completedActions: number
  manualActions: number
  plannedActions: number
  skippedActions: number
  fieldEvidenceAssets: number
  fieldEvidenceRows: number
  fieldEvidenceConflicts: number
  coherence: AssetIntelligenceReconcileCoherenceContext
  failures: Array<{ assetId: string; message: string }>
  assets: Array<{
    assetId: string
    courtAlias: string | null
    coherencePriority: number
    completenessScore: number
    confidenceScore: number
    actionKeys: string[]
    fieldEvidence: {
      totalFields: number
      resolvedFields: number
      conflictFields: number
      missingFields: number
    } | null
    results: AssetIntelligenceActionResult[]
  }>
}

export type AssetIntelligenceReconcileCoherenceContext = {
  enabled: boolean
  generatedAt: string | null
  targetedCourts: string[]
  criticalCourts: string[]
  partialCourts: string[]
  topGaps: Array<{
    courtAlias: string
    code: string
    severity: 'high' | 'medium' | 'low'
    missingCount: number
  }>
}

type CandidateAsset = {
  assetId: string
  courtAlias: string | null
  coherencePriority: number
}

class AssetIntelligenceReconcileService {
  async run(options: AssetIntelligenceReconcileOptions): Promise<AssetIntelligenceReconcileResult> {
    const dryRun = options.dryRun ?? false
    const coherence = await buildCoherenceContext(options)
    const candidates = await this.findCandidateAssets(options, coherence)
    const result: AssetIntelligenceReconcileResult = {
      tenantId: options.tenantId,
      dryRun,
      selectedAssets: candidates.length,
      inspectedAssets: 0,
      actedAssets: 0,
      skippedAssets: 0,
      failedAssets: 0,
      queuedActions: 0,
      completedActions: 0,
      manualActions: 0,
      plannedActions: 0,
      skippedActions: 0,
      fieldEvidenceAssets: 0,
      fieldEvidenceRows: 0,
      fieldEvidenceConflicts: 0,
      coherence,
      failures: [],
      assets: [],
    }

    for (const candidate of candidates) {
      try {
        result.inspectedAssets += 1
        const assetId = candidate.assetId
        const dossier = await assetIntelligenceDossierService.build(options.tenantId, assetId)
        const fieldEvidence =
          options.materializeFieldEvidence === false
            ? null
            : await assetFieldEvidenceService.materialize(options.tenantId, assetId, { dryRun })
        const actionKeys = selectActionKeys(dossier, options)

        if (fieldEvidence) {
          result.fieldEvidenceAssets += 1
          result.fieldEvidenceRows += fieldEvidence.totalFields
          result.fieldEvidenceConflicts += fieldEvidence.conflictFields
        }

        if (actionKeys.length === 0) {
          result.skippedAssets += 1
          result.assets.push({
            assetId,
            courtAlias: candidate.courtAlias,
            coherencePriority: candidate.coherencePriority,
            completenessScore: dossier.completeness.score,
            confidenceScore: dossier.confidence.score,
            actionKeys,
            fieldEvidence: fieldEvidenceSummary(fieldEvidence),
            results: [],
          })
          continue
        }

        const actionResult = await assetIntelligenceActionService.run(options.tenantId, assetId, {
          actions: actionKeys,
          dryRun,
          requestId: options.requestId,
        })

        result.actedAssets += 1
        result.assets.push({
          assetId,
          courtAlias: candidate.courtAlias,
          coherencePriority: candidate.coherencePriority,
          completenessScore: dossier.completeness.score,
          confidenceScore: dossier.confidence.score,
          actionKeys,
          fieldEvidence: fieldEvidenceSummary(fieldEvidence),
          results: actionResult.results,
        })
        accumulateActionMetrics(result, actionResult.results)
      } catch (error) {
        result.failedAssets += 1
        result.failures.push({
          assetId: candidate.assetId,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return result
  }

  private async findCandidateAssets(
    options: AssetIntelligenceReconcileOptions,
    coherence: AssetIntelligenceReconcileCoherenceContext
  ): Promise<CandidateAsset[]> {
    const query = db
      .from('precatorio_assets')
      .select('precatorio_assets.id')
      .select(db.raw(`${COURT_ALIAS_SQL} as court_alias`))
      .leftJoin('courts', 'courts.id', 'precatorio_assets.court_id')
      .leftJoin('debtors', 'debtors.id', 'precatorio_assets.debtor_id')
      .where('precatorio_assets.tenant_id', options.tenantId)
      .whereNull('precatorio_assets.deleted_at')
      .where((builder) => {
        builder
          .whereNull('precatorio_assets.current_score_id')
          .orWhereNull('precatorio_assets.current_score')
          .orWhereNotExists((subquery) => {
            subquery
              .from('judicial_processes')
              .select(db.raw('1'))
              .whereColumn('judicial_processes.tenant_id', 'precatorio_assets.tenant_id')
              .whereColumn('judicial_processes.asset_id', 'precatorio_assets.id')
              .whereNull('judicial_processes.deleted_at')
          })
          .orWhereNotExists((subquery) => {
            subquery
              .from('publications')
              .select(db.raw('1'))
              .whereColumn('publications.tenant_id', 'precatorio_assets.tenant_id')
              .whereColumn('publications.asset_id', 'precatorio_assets.id')
          })
          .orWhereNotExists((subquery) => {
            subquery
              .from('asset_valuations')
              .select(db.raw('1'))
              .whereColumn('asset_valuations.tenant_id', 'precatorio_assets.tenant_id')
              .whereColumn('asset_valuations.asset_id', 'precatorio_assets.id')
          })
          .orWhereNotExists((subquery) => {
            subquery
              .from('asset_budget_facts')
              .select(db.raw('1'))
              .whereColumn('asset_budget_facts.tenant_id', 'precatorio_assets.tenant_id')
              .whereColumn('asset_budget_facts.asset_id', 'precatorio_assets.id')
          })
          .orWhereNotExists((subquery) => {
            subquery
              .from('asset_source_links')
              .select(db.raw('1'))
              .whereColumn('asset_source_links.tenant_id', 'precatorio_assets.tenant_id')
              .whereColumn('asset_source_links.asset_id', 'precatorio_assets.id')
          })
          .orWhereExists((subquery) => {
            subquery
              .from('process_match_candidates')
              .select(db.raw('1'))
              .whereColumn('process_match_candidates.tenant_id', 'precatorio_assets.tenant_id')
              .whereColumn('process_match_candidates.asset_id', 'precatorio_assets.id')
              .whereIn('process_match_candidates.status', ['candidate', 'ambiguous'])
          })
          .orWhereExists((subquery) => {
            subquery
              .from('asset_source_links')
              .select(db.raw('1'))
              .whereColumn('asset_source_links.tenant_id', 'precatorio_assets.tenant_id')
              .whereColumn('asset_source_links.asset_id', 'precatorio_assets.id')
              .where('asset_source_links.link_type', 'conflict')
          })
      })
      .whereNotExists((subquery) => {
        subquery
          .from('audit_logs')
          .select(db.raw('1'))
          .whereColumn('audit_logs.tenant_id', 'precatorio_assets.tenant_id')
          .whereColumn('audit_logs.entity_id', 'precatorio_assets.id')
          .where('audit_logs.entity_type', 'precatorio_asset')
          .whereIn('audit_logs.event', [
            'asset_intelligence_actions_planned',
            'asset_intelligence_actions_executed',
          ])
          .where(
            'audit_logs.created_at',
            '>=',
            DateTime.utc()
              .minus({ hours: normalizeCooldown(options.recentActionCooldownHours) })
              .toJSDate()
          )
      })
      .orderBy('precatorio_assets.updated_at', 'asc')
      .limit(preselectionLimit(options.limit, coherence))

    if (options.source) {
      query.where('precatorio_assets.source', options.source)
    }

    const rows = await query
    return rows
      .map((row) => {
        const courtAlias = stringOrNull(row.court_alias)

        return {
          assetId: String(row.id),
          courtAlias,
          coherencePriority: coherencePriorityFor(courtAlias, coherence),
        }
      })
      .sort(compareCandidates)
      .slice(0, normalizeLimit(options.limit))
  }
}

const STATE_COURT_CASE_SQL = `
  case upper(debtors.state_code)
    when 'AC' then 'tjac'
    when 'AL' then 'tjal'
    when 'AM' then 'tjam'
    when 'AP' then 'tjap'
    when 'BA' then 'tjba'
    when 'CE' then 'tjce'
    when 'DF' then 'tjdft'
    when 'ES' then 'tjes'
    when 'GO' then 'tjgo'
    when 'MA' then 'tjma'
    when 'MG' then 'tjmg'
    when 'MS' then 'tjms'
    when 'MT' then 'tjmt'
    when 'PA' then 'tjpa'
    when 'PB' then 'tjpb'
    when 'PE' then 'tjpe'
    when 'PI' then 'tjpi'
    when 'PR' then 'tjpr'
    when 'RJ' then 'tjrj'
    when 'RN' then 'tjrn'
    when 'RO' then 'tjro'
    when 'RR' then 'tjrr'
    when 'RS' then 'tjrs'
    when 'SC' then 'tjsc'
    when 'SE' then 'tjse'
    when 'SP' then 'tjsp'
    when 'TO' then 'tjto'
    else null
  end
`

const COURT_ALIAS_SQL = `
  coalesce(
    nullif(lower(courts.alias), ''),
    (
      select lower(judicial_processes.court_alias)
      from judicial_processes
      where judicial_processes.tenant_id = precatorio_assets.tenant_id
        and judicial_processes.asset_id = precatorio_assets.id
        and judicial_processes.deleted_at is null
        and judicial_processes.court_alias is not null
      order by judicial_processes.created_at desc
      limit 1
    ),
    nullif(lower(precatorio_assets.raw_data->>'courtAlias'), ''),
    case
      when precatorio_assets.source = 'siop' then 'federal-siop'
      else null
    end,
    ${STATE_COURT_CASE_SQL}
  )
`

async function buildCoherenceContext(
  options: AssetIntelligenceReconcileOptions
): Promise<AssetIntelligenceReconcileCoherenceContext> {
  if (options.useNationalCoherence === false) {
    return emptyCoherenceContext(false)
  }

  const report = await nationalDataCoherenceService.build(options.tenantId)
  const criticalCourts = courtsByStatus(report, 'critical')
  const partialCourts = courtsByStatus(report, 'partial')
  const usableCourts = courtsByStatus(report, 'usable')

  return {
    enabled: true,
    generatedAt: report.generatedAt,
    criticalCourts,
    partialCourts,
    targetedCourts: [...new Set([...criticalCourts, ...partialCourts, ...usableCourts])],
    topGaps: report.gaps
      .filter((gap) => gap.missingCount > 0)
      .sort((left, right) => gapRank(right.severity) - gapRank(left.severity))
      .slice(0, 20)
      .map((gap) => ({
        courtAlias: gap.courtAlias,
        code: gap.code,
        severity: gap.severity,
        missingCount: gap.missingCount,
      })),
  }
}

function emptyCoherenceContext(enabled: boolean): AssetIntelligenceReconcileCoherenceContext {
  return {
    enabled,
    generatedAt: null,
    targetedCourts: [],
    criticalCourts: [],
    partialCourts: [],
    topGaps: [],
  }
}

function courtsByStatus(report: NationalDataCoherenceReport, status: NationalDataCoherenceStatus) {
  return report.courts
    .filter((court) => court.status === status && court.totalAssets > 0)
    .map((court) => court.courtAlias)
}

function coherencePriorityFor(
  courtAlias: string | null,
  coherence: AssetIntelligenceReconcileCoherenceContext
) {
  if (!coherence.enabled || !courtAlias) {
    return 0
  }

  if (coherence.criticalCourts.includes(courtAlias)) {
    return 300
  }

  if (coherence.partialCourts.includes(courtAlias)) {
    return 200
  }

  if (coherence.targetedCourts.includes(courtAlias)) {
    return 100
  }

  return 0
}

function compareCandidates(left: CandidateAsset, right: CandidateAsset) {
  return (
    right.coherencePriority - left.coherencePriority || left.assetId.localeCompare(right.assetId)
  )
}

function preselectionLimit(
  limit: number | null | undefined,
  coherence: AssetIntelligenceReconcileCoherenceContext
) {
  const normalized = normalizeLimit(limit)
  return coherence.enabled ? Math.min(normalized * 4, MAX_LIMIT) : normalized
}

function gapRank(severity: 'high' | 'medium' | 'low') {
  switch (severity) {
    case 'high':
      return 3
    case 'medium':
      return 2
    case 'low':
      return 1
  }
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim().toLowerCase() : null
}

function selectActionKeys(
  dossier: Awaited<ReturnType<typeof assetIntelligenceDossierService.build>>,
  options: AssetIntelligenceReconcileOptions
) {
  const hasHighConflict = dossier.nextBestActions.some(
    (action) => action.key === 'resolve_high_severity_conflicts'
  )
  const includeManualActions = options.includeManualActions ?? true
  const maxActions = normalizeMaxActions(options.maxActionsPerAsset)
  let actions = dossier.nextBestActions

  if (hasHighConflict && options.allowAutomationWithConflicts !== true) {
    actions = actions.filter((action) => action.key === 'resolve_high_severity_conflicts')
  }

  if (options.highPriorityOnly) {
    actions = actions.filter((action) => action.priority === 'high')
  }

  if (!includeManualActions) {
    actions = actions.filter(
      (action) =>
        !['resolve_high_severity_conflicts', 'link_primary_source_evidence'].includes(action.key)
    )
  }

  return actions
    .sort((left, right) => priorityRank(right.priority) - priorityRank(left.priority))
    .slice(0, maxActions)
    .map((action) => action.key)
}

function accumulateActionMetrics(
  result: AssetIntelligenceReconcileResult,
  actions: AssetIntelligenceActionResult[]
) {
  for (const action of actions) {
    if (action.status === 'queued') result.queuedActions += 1
    if (action.status === 'completed') result.completedActions += 1
    if (action.status === 'manual') result.manualActions += 1
    if (action.status === 'planned') result.plannedActions += 1
    if (action.status === 'skipped') result.skippedActions += 1
  }
}

function fieldEvidenceSummary(
  fieldEvidence: Awaited<ReturnType<typeof assetFieldEvidenceService.materialize>> | null
) {
  if (!fieldEvidence) return null

  return {
    totalFields: fieldEvidence.totalFields,
    resolvedFields: fieldEvidence.resolvedFields,
    conflictFields: fieldEvidence.conflictFields,
    missingFields: fieldEvidence.missingFields,
  }
}

function priorityRank(priority: ReconcileActionPriority) {
  switch (priority) {
    case 'high':
      return 3
    case 'medium':
      return 2
    case 'low':
      return 1
  }
}

function normalizeLimit(value?: number | null) {
  if (!value || value < 1) {
    return DEFAULT_LIMIT
  }

  return Math.min(Math.trunc(value), MAX_LIMIT)
}

function normalizeMaxActions(value?: number | null) {
  if (!value || value < 1) {
    return DEFAULT_MAX_ACTIONS_PER_ASSET
  }

  return Math.min(Math.trunc(value), 10)
}

function normalizeCooldown(value?: number | null) {
  if (value === 0) {
    return 0
  }

  if (!value || value < 0) {
    return DEFAULT_RECENT_ACTION_COOLDOWN_HOURS
  }

  return Math.min(Math.trunc(value), 168)
}

export const assetIntelligenceReconcileService = new AssetIntelligenceReconcileService()
export default assetIntelligenceReconcileService
