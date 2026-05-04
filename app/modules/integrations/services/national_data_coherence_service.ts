import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import governmentCoverageMatrixService from '#modules/integrations/services/government_coverage_matrix_service'

const STATE_BY_COURT_ALIAS = new Map([
  ['tjac', 'AC'],
  ['tjal', 'AL'],
  ['tjam', 'AM'],
  ['tjap', 'AP'],
  ['tjba', 'BA'],
  ['tjce', 'CE'],
  ['tjdft', 'DF'],
  ['tjes', 'ES'],
  ['tjgo', 'GO'],
  ['tjma', 'MA'],
  ['tjmg', 'MG'],
  ['tjms', 'MS'],
  ['tjmt', 'MT'],
  ['tjpa', 'PA'],
  ['tjpb', 'PB'],
  ['tjpe', 'PE'],
  ['tjpi', 'PI'],
  ['tjpr', 'PR'],
  ['tjrj', 'RJ'],
  ['tjrn', 'RN'],
  ['tjro', 'RO'],
  ['tjrr', 'RR'],
  ['tjrs', 'RS'],
  ['tjsc', 'SC'],
  ['tjse', 'SE'],
  ['tjsp', 'SP'],
  ['tjto', 'TO'],
])

const STATE_COURT_CASE = `
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

export type NationalDataCoherenceStatus = 'complete' | 'usable' | 'partial' | 'critical'

export type NationalDataCoherenceReport = {
  generatedAt: string
  summary: NationalDataCoherenceSummary
  courts: NationalDataCoherenceCourt[]
  gaps: NationalDataCoherenceGap[]
}

export type NationalDataCoherenceSummary = {
  totalAssets: number
  completeAssets: number
  completeRate: number
  primarySourceCoverage: number
  dataJudProcessCoverage: number
  djenPublicationCoverage: number
  valuationCoverage: number
  scoreCoverage: number
  fieldEvidenceCoverage: number
  fieldEvidenceResolvedCoverage: number
  conflictedAssets: number
  fieldEvidenceConflictAssets: number
  pendingCandidateReviewAssets: number
  courtsCount: number
  courtsWithAssetsCount: number
  readyCourtsCount: number
  criticalCourtsCount: number
}

export type NationalDataCoherenceCourt = {
  level: 'federal' | 'state' | 'unknown'
  stateCode: string | null
  courtAlias: string
  totalAssets: number
  completeAssets: number
  completeRate: number
  primarySourceAssets: number
  dataJudProcessAssets: number
  djenPublicationAssets: number
  valuationAssets: number
  scoredAssets: number
  fieldEvidenceAssets: number
  fieldEvidenceResolvedAssets: number
  conflictedAssets: number
  fieldEvidenceConflictAssets: number
  pendingCandidateReviewAssets: number
  missing: {
    primarySource: number
    dataJudProcess: number
    djenPublication: number
    valuation: number
    score: number
    fieldEvidence: number
  }
  status: NationalDataCoherenceStatus
  recommendedActions: string[]
}

export type NationalDataCoherenceGap = {
  level: 'federal' | 'state' | 'unknown'
  stateCode: string | null
  courtAlias: string
  severity: 'high' | 'medium' | 'low'
  code: string
  missingCount: number
  message: string
  recommendedAction: string
}

type CoherenceRow = {
  court_alias: string | null
  total_assets: string | number | null
  primary_source_assets: string | number | null
  datajud_process_assets: string | number | null
  djen_publication_assets: string | number | null
  valuation_assets: string | number | null
  scored_assets: string | number | null
  field_evidence_assets: string | number | null
  field_evidence_resolved_assets: string | number | null
  conflicted_assets: string | number | null
  field_evidence_conflict_assets: string | number | null
  pending_candidate_review_assets: string | number | null
  complete_assets: string | number | null
}

class NationalDataCoherenceService {
  async build(tenantId: string): Promise<NationalDataCoherenceReport> {
    const [matrix, rows] = await Promise.all([
      governmentCoverageMatrixService.build(tenantId),
      this.fetchRows(tenantId),
    ])
    const rowByCourt = new Map(rows.map((row) => [normalizeCourtAlias(row.court_alias), row]))
    const courtAliases = [
      ...matrix.federal.map((item) => item.courtAlias),
      ...matrix.states.map((state) => state.courtAlias),
      ...rows.map((row) => normalizeCourtAlias(row.court_alias)),
    ]
    const courts = [...new Set(courtAliases)]
      .filter((courtAlias) => courtAlias !== '')
      .map((courtAlias) => this.buildCourt(courtAlias, rowByCourt.get(courtAlias) ?? null))
      .sort(compareCourts)
    const summary = summarize(courts)

    return {
      generatedAt: DateTime.utc().toISO(),
      summary,
      courts,
      gaps: courts.flatMap(courtGaps),
    }
  }

  private async fetchRows(tenantId: string) {
    const result = await db.rawQuery(
      `
        with judicial_process_flags as (
          select
            judicial_processes.asset_id,
            min(lower(judicial_processes.court_alias)) filter (
              where judicial_processes.court_alias is not null
            ) as court_alias,
            bool_or(judicial_processes.source = 'datajud') as has_datajud_process
          from judicial_processes
          where judicial_processes.tenant_id = ?
            and judicial_processes.deleted_at is null
            and judicial_processes.asset_id is not null
          group by judicial_processes.asset_id
        ),
        asset_base as (
          select
            precatorio_assets.id,
            coalesce(
              nullif(lower(courts.alias), ''),
              judicial_process_flags.court_alias,
              nullif(lower(precatorio_assets.raw_data->>'courtAlias'), ''),
              case
                when precatorio_assets.source = 'siop' then 'federal-siop'
                else null
              end,
              ${STATE_COURT_CASE},
              'unknown'
            ) as court_alias,
            (
              precatorio_assets.source in ('siop', 'tribunal')
              or source_records.source in ('siop', 'tribunal')
            ) as has_primary_source,
            (
              precatorio_assets.current_score_id is not null
              or precatorio_assets.current_score is not null
            ) as has_inline_score
          from precatorio_assets
          left join courts on courts.id = precatorio_assets.court_id
          left join debtors on debtors.id = precatorio_assets.debtor_id
          left join judicial_process_flags
            on judicial_process_flags.asset_id = precatorio_assets.id
          left join source_records
            on source_records.id = precatorio_assets.source_record_id
            and source_records.tenant_id = precatorio_assets.tenant_id
          where precatorio_assets.tenant_id = ?
            and precatorio_assets.deleted_at is null
        ),
        primary_source_links as (
          select asset_source_links.asset_id
          from asset_source_links
          left join source_datasets
            on source_datasets.id = asset_source_links.source_dataset_id
          where asset_source_links.tenant_id = ?
            and (
              asset_source_links.link_type = 'primary'
              or (
                asset_source_links.link_type <> 'conflict'
                and source_datasets.priority = 'primary'
              )
            )
          group by asset_source_links.asset_id
        ),
        djen_publications as (
          select publications.asset_id
          from publications
          where publications.tenant_id = ?
            and publications.source = 'djen'
            and publications.asset_id is not null
          group by publications.asset_id
          union
          select judicial_processes.asset_id
          from publications
          inner join judicial_processes
            on judicial_processes.id = publications.process_id
            and judicial_processes.tenant_id = publications.tenant_id
            and judicial_processes.deleted_at is null
          where publications.tenant_id = ?
            and publications.source = 'djen'
            and judicial_processes.asset_id is not null
          group by judicial_processes.asset_id
        ),
        valuations as (
          select asset_valuations.asset_id
          from asset_valuations
          where asset_valuations.tenant_id = ?
          group by asset_valuations.asset_id
        ),
        scores as (
          select asset_scores.asset_id
          from asset_scores
          where asset_scores.tenant_id = ?
          group by asset_scores.asset_id
        ),
        field_evidence as (
          select
            asset_field_evidences.asset_id,
            count(*) as evidence_count,
            count(distinct asset_field_evidences.field_key) filter (
              where asset_field_evidences.status = 'resolved'
                and asset_field_evidences.field_key in (
                  'cnj_number',
                  'debtor_name',
                  'court_alias',
                  'face_value'
                )
            ) as resolved_core_fields,
            count(*) filter (
              where asset_field_evidences.status = 'conflict'
            ) as conflict_count
          from asset_field_evidences
          where asset_field_evidences.tenant_id = ?
          group by asset_field_evidences.asset_id
        ),
        source_conflicts as (
          select asset_source_links.asset_id
          from asset_source_links
          where asset_source_links.tenant_id = ?
            and asset_source_links.link_type = 'conflict'
          group by asset_source_links.asset_id
        ),
        pending_candidates as (
          select process_match_candidates.asset_id
          from process_match_candidates
          where process_match_candidates.tenant_id = ?
            and process_match_candidates.status in ('candidate', 'ambiguous')
          group by process_match_candidates.asset_id
        )
        select
          asset_base.court_alias,
          count(*) as total_assets,
          count(*) filter (
            where asset_base.has_primary_source
              or primary_source_links.asset_id is not null
          ) as primary_source_assets,
          count(*) filter (
            where judicial_process_flags.has_datajud_process
          ) as datajud_process_assets,
          count(*) filter (where djen_publications.asset_id is not null) as djen_publication_assets,
          count(*) filter (where valuations.asset_id is not null) as valuation_assets,
          count(*) filter (
            where asset_base.has_inline_score
              or scores.asset_id is not null
          ) as scored_assets,
          count(*) filter (
            where coalesce(field_evidence.evidence_count, 0) > 0
          ) as field_evidence_assets,
          count(*) filter (
            where coalesce(field_evidence.resolved_core_fields, 0) >= 4
          ) as field_evidence_resolved_assets,
          count(*) filter (where source_conflicts.asset_id is not null) as conflicted_assets,
          count(*) filter (
            where coalesce(field_evidence.conflict_count, 0) > 0
          ) as field_evidence_conflict_assets,
          count(*) filter (where pending_candidates.asset_id is not null) as pending_candidate_review_assets,
          count(*) filter (
            where (
                asset_base.has_primary_source
                or primary_source_links.asset_id is not null
              )
              and judicial_process_flags.has_datajud_process
              and djen_publications.asset_id is not null
              and valuations.asset_id is not null
              and (
                asset_base.has_inline_score
                or scores.asset_id is not null
              )
              and coalesce(field_evidence.resolved_core_fields, 0) >= 4
              and source_conflicts.asset_id is null
              and coalesce(field_evidence.conflict_count, 0) = 0
              and pending_candidates.asset_id is null
          ) as complete_assets
        from asset_base
        left join primary_source_links
          on primary_source_links.asset_id = asset_base.id
        left join judicial_process_flags
          on judicial_process_flags.asset_id = asset_base.id
        left join djen_publications
          on djen_publications.asset_id = asset_base.id
        left join valuations
          on valuations.asset_id = asset_base.id
        left join scores
          on scores.asset_id = asset_base.id
        left join field_evidence
          on field_evidence.asset_id = asset_base.id
        left join source_conflicts
          on source_conflicts.asset_id = asset_base.id
        left join pending_candidates
          on pending_candidates.asset_id = asset_base.id
        group by asset_base.court_alias
      `,
      [
        tenantId,
        tenantId,
        tenantId,
        tenantId,
        tenantId,
        tenantId,
        tenantId,
        tenantId,
        tenantId,
        tenantId,
      ]
    )

    return result.rows as CoherenceRow[]
  }

  private buildCourt(courtAlias: string, row: CoherenceRow | null): NationalDataCoherenceCourt {
    const totalAssets = numberFrom(row?.total_assets)
    const primarySourceAssets = numberFrom(row?.primary_source_assets)
    const dataJudProcessAssets = numberFrom(row?.datajud_process_assets)
    const djenPublicationAssets = numberFrom(row?.djen_publication_assets)
    const valuationAssets = numberFrom(row?.valuation_assets)
    const scoredAssets = numberFrom(row?.scored_assets)
    const fieldEvidenceAssets = numberFrom(row?.field_evidence_assets)
    const fieldEvidenceResolvedAssets = numberFrom(row?.field_evidence_resolved_assets)
    const conflictedAssets = numberFrom(row?.conflicted_assets)
    const fieldEvidenceConflictAssets = numberFrom(row?.field_evidence_conflict_assets)
    const pendingCandidateReviewAssets = numberFrom(row?.pending_candidate_review_assets)
    const completeAssets = numberFrom(row?.complete_assets)
    const court = {
      level: levelFor(courtAlias),
      stateCode: stateFor(courtAlias),
      courtAlias,
      totalAssets,
      completeAssets,
      completeRate: ratio(completeAssets, totalAssets),
      primarySourceAssets,
      dataJudProcessAssets,
      djenPublicationAssets,
      valuationAssets,
      scoredAssets,
      fieldEvidenceAssets,
      fieldEvidenceResolvedAssets,
      conflictedAssets,
      fieldEvidenceConflictAssets,
      pendingCandidateReviewAssets,
      missing: {
        primarySource: Math.max(0, totalAssets - primarySourceAssets),
        dataJudProcess: Math.max(0, totalAssets - dataJudProcessAssets),
        djenPublication: Math.max(0, totalAssets - djenPublicationAssets),
        valuation: Math.max(0, totalAssets - valuationAssets),
        score: Math.max(0, totalAssets - scoredAssets),
        fieldEvidence: Math.max(0, totalAssets - fieldEvidenceResolvedAssets),
      },
      status: 'critical' as NationalDataCoherenceStatus,
      recommendedActions: [] as string[],
    }
    const gaps = courtGaps(court)

    return {
      ...court,
      status: statusFor(court, gaps),
      recommendedActions: gaps.map((item) => item.recommendedAction).slice(0, 4),
    }
  }
}

function courtGaps(court: NationalDataCoherenceCourt): NationalDataCoherenceGap[] {
  const gaps: NationalDataCoherenceGap[] = []

  if (court.totalAssets === 0) {
    gaps.push(gap(court, 'medium', 'no_assets', 0, 'No canonical assets have been linked yet.'))
    return gaps
  }

  if (court.missing.primarySource > 0) {
    gaps.push(
      gap(
        court,
        'high',
        'missing_primary_source',
        court.missing.primarySource,
        'Link assets to their primary government source records.'
      )
    )
  }

  if (court.missing.dataJudProcess > 0) {
    gaps.push(
      gap(
        court,
        'medium',
        'missing_datajud_process',
        court.missing.dataJudProcess,
        'Run DataJud enrichment and candidate review for assets without process metadata.'
      )
    )
  }

  if (court.missing.djenPublication > 0) {
    gaps.push(
      gap(
        court,
        'medium',
        'missing_djen_publication',
        court.missing.djenPublication,
        'Run DJEN publication monitoring to attach liquidity and risk events.'
      )
    )
  }

  if (court.missing.valuation > 0) {
    gaps.push(
      gap(
        court,
        'medium',
        'missing_valuation',
        court.missing.valuation,
        'Create valuation snapshots before ranking liquidity opportunities.'
      )
    )
  }

  if (court.missing.score > 0) {
    gaps.push(
      gap(
        court,
        'medium',
        'missing_score',
        court.missing.score,
        'Recompute legal and financial scores for assets without current scoring evidence.'
      )
    )
  }

  if (court.missing.fieldEvidence > 0) {
    gaps.push(
      gap(
        court,
        'medium',
        'missing_field_evidence',
        court.missing.fieldEvidence,
        'Materialize golden-record field evidence for CNJ, debtor, court, and value fields.'
      )
    )
  }

  if (court.conflictedAssets > 0) {
    gaps.push(
      gap(
        court,
        'high',
        'source_conflicts',
        court.conflictedAssets,
        'Resolve conflicting source links before automation treats these assets as reliable.'
      )
    )
  }

  if (court.fieldEvidenceConflictAssets > 0) {
    gaps.push(
      gap(
        court,
        'high',
        'field_evidence_conflicts',
        court.fieldEvidenceConflictAssets,
        'Review conflicting canonical field evidence before updating golden records.'
      )
    )
  }

  if (court.pendingCandidateReviewAssets > 0) {
    gaps.push(
      gap(
        court,
        'medium',
        'pending_candidate_review',
        court.pendingCandidateReviewAssets,
        'Review ambiguous DataJud candidates and promote or reject each match.'
      )
    )
  }

  return gaps
}

function gap(
  court: NationalDataCoherenceCourt,
  severity: NationalDataCoherenceGap['severity'],
  code: string,
  missingCount: number,
  recommendedAction: string
): NationalDataCoherenceGap {
  const courtLabel = court.courtAlias.toUpperCase()

  return {
    level: court.level,
    stateCode: court.stateCode,
    courtAlias: court.courtAlias,
    severity,
    code,
    missingCount,
    message:
      missingCount > 0
        ? `${courtLabel} has ${missingCount} asset(s) affected by ${code}.`
        : `${courtLabel} has no canonical assets for coherence analysis yet.`,
    recommendedAction,
  }
}

function summarize(courts: NationalDataCoherenceCourt[]): NationalDataCoherenceSummary {
  const totals = courts.reduce(
    (memo, court) => ({
      totalAssets: memo.totalAssets + court.totalAssets,
      completeAssets: memo.completeAssets + court.completeAssets,
      primarySourceAssets: memo.primarySourceAssets + court.primarySourceAssets,
      dataJudProcessAssets: memo.dataJudProcessAssets + court.dataJudProcessAssets,
      djenPublicationAssets: memo.djenPublicationAssets + court.djenPublicationAssets,
      valuationAssets: memo.valuationAssets + court.valuationAssets,
      scoredAssets: memo.scoredAssets + court.scoredAssets,
      fieldEvidenceAssets: memo.fieldEvidenceAssets + court.fieldEvidenceAssets,
      fieldEvidenceResolvedAssets:
        memo.fieldEvidenceResolvedAssets + court.fieldEvidenceResolvedAssets,
      conflictedAssets: memo.conflictedAssets + court.conflictedAssets,
      fieldEvidenceConflictAssets:
        memo.fieldEvidenceConflictAssets + court.fieldEvidenceConflictAssets,
      pendingCandidateReviewAssets:
        memo.pendingCandidateReviewAssets + court.pendingCandidateReviewAssets,
    }),
    {
      totalAssets: 0,
      completeAssets: 0,
      primarySourceAssets: 0,
      dataJudProcessAssets: 0,
      djenPublicationAssets: 0,
      valuationAssets: 0,
      scoredAssets: 0,
      fieldEvidenceAssets: 0,
      fieldEvidenceResolvedAssets: 0,
      conflictedAssets: 0,
      fieldEvidenceConflictAssets: 0,
      pendingCandidateReviewAssets: 0,
    }
  )

  return {
    totalAssets: totals.totalAssets,
    completeAssets: totals.completeAssets,
    completeRate: ratio(totals.completeAssets, totals.totalAssets),
    primarySourceCoverage: ratio(totals.primarySourceAssets, totals.totalAssets),
    dataJudProcessCoverage: ratio(totals.dataJudProcessAssets, totals.totalAssets),
    djenPublicationCoverage: ratio(totals.djenPublicationAssets, totals.totalAssets),
    valuationCoverage: ratio(totals.valuationAssets, totals.totalAssets),
    scoreCoverage: ratio(totals.scoredAssets, totals.totalAssets),
    fieldEvidenceCoverage: ratio(totals.fieldEvidenceAssets, totals.totalAssets),
    fieldEvidenceResolvedCoverage: ratio(totals.fieldEvidenceResolvedAssets, totals.totalAssets),
    conflictedAssets: totals.conflictedAssets,
    fieldEvidenceConflictAssets: totals.fieldEvidenceConflictAssets,
    pendingCandidateReviewAssets: totals.pendingCandidateReviewAssets,
    courtsCount: courts.length,
    courtsWithAssetsCount: courts.filter((court) => court.totalAssets > 0).length,
    readyCourtsCount: courts.filter((court) => court.status === 'complete').length,
    criticalCourtsCount: courts.filter((court) => court.status === 'critical').length,
  }
}

function statusFor(
  court: NationalDataCoherenceCourt,
  gaps: NationalDataCoherenceGap[]
): NationalDataCoherenceStatus {
  if (court.totalAssets === 0) {
    return 'partial'
  }

  if (gaps.some((item) => item.severity === 'high')) {
    return 'critical'
  }

  if (court.completeRate >= 0.95) {
    return 'complete'
  }

  if (court.primarySourceAssets > 0 && court.dataJudProcessAssets > 0 && court.scoredAssets > 0) {
    return 'usable'
  }

  return 'partial'
}

function compareCourts(left: NationalDataCoherenceCourt, right: NationalDataCoherenceCourt) {
  return (
    levelRank(left.level) - levelRank(right.level) ||
    (left.stateCode ?? '').localeCompare(right.stateCode ?? '') ||
    left.courtAlias.localeCompare(right.courtAlias)
  )
}

function levelRank(level: NationalDataCoherenceCourt['level']) {
  const ranks: Record<NationalDataCoherenceCourt['level'], number> = {
    federal: 0,
    state: 1,
    unknown: 2,
  }

  return ranks[level]
}

function levelFor(courtAlias: string): NationalDataCoherenceCourt['level'] {
  if (courtAlias.startsWith('trf') || courtAlias === 'federal-siop') {
    return 'federal'
  }

  if (STATE_BY_COURT_ALIAS.has(courtAlias)) {
    return 'state'
  }

  return 'unknown'
}

function stateFor(courtAlias: string) {
  return STATE_BY_COURT_ALIAS.get(courtAlias) ?? null
}

function ratio(value: number, total: number) {
  if (total <= 0) {
    return 0
  }

  return Number((value / total).toFixed(4))
}

function numberFrom(value: string | number | null | undefined) {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string') {
    return Number(value)
  }

  return 0
}

function normalizeCourtAlias(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

export default new NationalDataCoherenceService()
