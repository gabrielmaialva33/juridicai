import { DateTime } from 'luxon'
import type {
  CoverageLayer,
  CoverageLayerStatus,
  GovernmentCoverageMatrix,
} from '#modules/integrations/services/government_coverage_matrix_service'
import type { SourceDataQualitySummary } from '#modules/integrations/services/source_data_quality_service'

export type CoverageRecoveryPriority = 'critical' | 'high' | 'medium' | 'low'

export type CoverageRecoveryTarget = {
  level: 'federal' | 'state'
  stateCode: string | null
  courtAlias: string
  layer: 'primary'
  targetKey: string
  adapterKey: string | null
  status: CoverageLayerStatus
  priority: CoverageRecoveryPriority
  priorityScore: number
  staleDays: number | null
  quality: SourceDataQualitySummary | null
  reasons: string[]
  recommendedAction: string
}

export type CoverageRecoveryPlan = {
  generatedAt: string
  executableTargetKeys: string[]
  targets: CoverageRecoveryTarget[]
  summary: {
    executableTargetsCount: number
    criticalTargetsCount: number
    highTargetsCount: number
    mediumTargetsCount: number
    lowTargetsCount: number
    missingAdapterTargetsCount: number
  }
}

class GovernmentCoverageRecoveryPlanService {
  build(matrix: GovernmentCoverageMatrix): CoverageRecoveryPlan {
    const stateTargets = matrix.states
      .map((state) =>
        recoveryTarget({
          level: 'state',
          stateCode: state.stateCode,
          courtAlias: state.courtAlias,
          layer: state.primary,
        })
      )
      .filter((target): target is CoverageRecoveryTarget => target !== null)
    const federalTargets = matrix.federal
      .map((item) =>
        recoveryTarget({
          level: 'federal',
          stateCode: null,
          courtAlias: item.courtAlias,
          layer: item.primary,
        })
      )
      .filter((target): target is CoverageRecoveryTarget => target !== null)
    const targets = [...stateTargets, ...federalTargets].sort(compareRecoveryTargets)

    return {
      generatedAt: DateTime.utc().toISO(),
      executableTargetKeys: targets.map((target) => target.targetKey),
      targets,
      summary: {
        executableTargetsCount: targets.length,
        criticalTargetsCount: countByPriority(targets, 'critical'),
        highTargetsCount: countByPriority(targets, 'high'),
        mediumTargetsCount: countByPriority(targets, 'medium'),
        lowTargetsCount: countByPriority(targets, 'low'),
        missingAdapterTargetsCount: matrix.gaps.filter((gap) =>
          ['primary_source_missing', 'primary_source_mapped_without_adapter'].includes(gap.code)
        ).length,
      },
    }
  }
}

function recoveryTarget(input: {
  level: 'federal' | 'state'
  stateCode: string | null
  courtAlias: string
  layer: CoverageLayer
}): CoverageRecoveryTarget | null {
  if (!input.layer.targetKey || !shouldExecute(input.layer)) {
    return null
  }

  const reasons = recoveryReasons(input.layer)
  const priorityScore = recoveryPriorityScore(input.layer, reasons)
  const priority = priorityFor(priorityScore)

  return {
    level: input.level,
    stateCode: input.stateCode,
    courtAlias: input.courtAlias,
    layer: 'primary',
    targetKey: input.layer.targetKey,
    adapterKey: input.layer.adapterKey,
    status: input.layer.status,
    priority,
    priorityScore,
    staleDays: staleDays(input.layer.lastSuccessAt),
    quality: input.layer.quality,
    reasons,
    recommendedAction: recommendedAction(input.courtAlias, priority, reasons),
  }
}

function shouldExecute(layer: CoverageLayer) {
  return (
    Boolean(layer.adapterKey) &&
    Boolean(layer.targetKey) &&
    (layer.status === 'configured' || layer.status === 'validated')
  )
}

function recoveryReasons(layer: CoverageLayer) {
  const reasons: string[] = []
  const ageDays = staleDays(layer.lastSuccessAt)
  const quality = layer.quality

  if (layer.status === 'configured') {
    reasons.push('configured_without_validated_run')
  }

  if (!layer.lastSuccessAt) {
    reasons.push('never_succeeded')
  } else if (ageDays !== null && ageDays >= 7) {
    reasons.push('stale_success')
  }

  if (layer.tenantSourceRecordsCount === 0) {
    reasons.push('no_tenant_source_records')
  }

  if (!quality) {
    reasons.push('quality_unknown')
  } else {
    if (quality.grade === 'D' || quality.score < 0.5) {
      reasons.push('quality_failed')
    } else if (quality.grade === 'C' || quality.score < 0.7) {
      reasons.push('quality_weak')
    }

    if (quality.importYield < 0.5) {
      reasons.push('low_import_yield')
    }

    if (quality.errorRate >= 0.25) {
      reasons.push('high_error_rate')
    }

    if ((quality.fieldCoverage.average ?? 1) < 0.65) {
      reasons.push('low_field_coverage')
    }
  }

  return reasons.length > 0 ? reasons : ['healthy_refresh']
}

function recoveryPriorityScore(layer: CoverageLayer, reasons: string[]) {
  let score = 0
  const quality = layer.quality
  const ageDays = staleDays(layer.lastSuccessAt)

  if (reasons.includes('never_succeeded')) {
    score += 50
  }

  if (reasons.includes('configured_without_validated_run')) {
    score += 35
  }

  if (reasons.includes('no_tenant_source_records')) {
    score += 30
  }

  if (reasons.includes('quality_unknown')) {
    score += 10
  }

  if (reasons.includes('quality_failed')) {
    score += 35
  } else if (reasons.includes('quality_weak')) {
    score += 20
  }

  if (reasons.includes('low_import_yield')) {
    score += 20
  }

  if (reasons.includes('high_error_rate')) {
    score += 20
  }

  if (reasons.includes('low_field_coverage')) {
    score += 15
  }

  if (ageDays !== null) {
    score += Math.min(ageDays, 30)
  }

  if (quality) {
    score += Math.round((1 - quality.score) * 20)
  }

  if (layer.status === 'validated' && reasons.length === 1 && reasons[0] === 'healthy_refresh') {
    score += 5
  }

  return score
}

function priorityFor(score: number): CoverageRecoveryPriority {
  if (score >= 80) {
    return 'critical'
  }

  if (score >= 50) {
    return 'high'
  }

  if (score >= 25) {
    return 'medium'
  }

  return 'low'
}

function compareRecoveryTargets(left: CoverageRecoveryTarget, right: CoverageRecoveryTarget) {
  return (
    right.priorityScore - left.priorityScore ||
    levelRank(left.level) - levelRank(right.level) ||
    left.courtAlias.localeCompare(right.courtAlias)
  )
}

function levelRank(level: 'federal' | 'state') {
  return level === 'federal' ? 0 : 1
}

function countByPriority(targets: CoverageRecoveryTarget[], priority: CoverageRecoveryPriority) {
  return targets.filter((target) => target.priority === priority).length
}

function staleDays(lastSuccessAt: string | null) {
  if (!lastSuccessAt) {
    return null
  }

  const lastSuccess = DateTime.fromISO(lastSuccessAt)

  if (!lastSuccess.isValid) {
    return null
  }

  return Math.max(0, Math.floor(DateTime.utc().diff(lastSuccess.toUTC(), 'days').days))
}

function recommendedAction(
  courtAlias: string,
  priority: CoverageRecoveryPriority,
  reasons: string[]
) {
  const court = courtAlias.toUpperCase()

  if (reasons.includes('never_succeeded') || reasons.includes('no_tenant_source_records')) {
    return `Run ${court} immediately and inspect whether the source still publishes downloadable precatorio records.`
  }

  if (reasons.includes('quality_failed') || reasons.includes('high_error_rate')) {
    return `Retry ${court} with focused diagnostics and inspect parser/import errors before trusting coverage.`
  }

  if (reasons.includes('quality_weak') || reasons.includes('low_field_coverage')) {
    return `Backfill ${court} and compare field completeness against the last successful import.`
  }

  return priority === 'low'
    ? `Refresh ${court} on the normal cadence.`
    : `Prioritize ${court} in the next automatic coverage run.`
}

export default new GovernmentCoverageRecoveryPlanService()
