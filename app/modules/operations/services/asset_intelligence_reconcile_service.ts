import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import assetIntelligenceActionService, {
  type AssetIntelligenceActionResult,
} from '#modules/operations/services/asset_intelligence_action_service'
import assetIntelligenceDossierService from '#modules/operations/services/asset_intelligence_dossier_service'
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
  failures: Array<{ assetId: string; message: string }>
  assets: Array<{
    assetId: string
    completenessScore: number
    confidenceScore: number
    actionKeys: string[]
    results: AssetIntelligenceActionResult[]
  }>
}

class AssetIntelligenceReconcileService {
  async run(options: AssetIntelligenceReconcileOptions): Promise<AssetIntelligenceReconcileResult> {
    const dryRun = options.dryRun ?? false
    const candidates = await this.findCandidateAssetIds(options)
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
      failures: [],
      assets: [],
    }

    for (const assetId of candidates) {
      try {
        result.inspectedAssets += 1
        const dossier = await assetIntelligenceDossierService.build(options.tenantId, assetId)
        const actionKeys = selectActionKeys(dossier, options)

        if (actionKeys.length === 0) {
          result.skippedAssets += 1
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
          completenessScore: dossier.completeness.score,
          confidenceScore: dossier.confidence.score,
          actionKeys,
          results: actionResult.results,
        })
        accumulateActionMetrics(result, actionResult.results)
      } catch (error) {
        result.failedAssets += 1
        result.failures.push({
          assetId,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return result
  }

  private async findCandidateAssetIds(options: AssetIntelligenceReconcileOptions) {
    const query = db
      .from('precatorio_assets')
      .select('precatorio_assets.id')
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
      .limit(normalizeLimit(options.limit))

    if (options.source) {
      query.where('precatorio_assets.source', options.source)
    }

    const rows = await query
    return rows.map((row) => String(row.id))
  }
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
