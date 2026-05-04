import type { PrecatorioListFilters } from '#modules/precatorios/repositories/precatorio_repository'
import precatorioRepository from '#modules/precatorios/repositories/precatorio_repository'
import precatorioTimelineService from '#modules/precatorios/services/precatorio_timeline_service'
import db from '@adonisjs/lucid/services/db'

export type PrecatorioListDataQuality = {
  status: 'complete' | 'review' | 'blocked'
  issues: string[]
  hasValuation: boolean
  hasDataJudProcess: boolean
  hasDjenPublication: boolean
  resolvedCoreFields: number
  fieldEvidenceConflicts: number
  sourceConflicts: number
  pendingCandidateReviews: number
}

class PrecatorioService {
  list(tenantId: string, filters: PrecatorioListFilters) {
    return precatorioRepository.list(tenantId, filters)
  }

  async enrichListDataQuality(tenantId: string, assets: Array<Record<string, any>>) {
    if (assets.length === 0) {
      return assets
    }

    const ids = assets.map((asset) => String(asset.id)).filter(Boolean)
    const result = await db.rawQuery(
      `
        select
          precatorio_assets.id,
          exists (
            select 1
            from asset_valuations
            where asset_valuations.tenant_id = precatorio_assets.tenant_id
              and asset_valuations.asset_id = precatorio_assets.id
              and coalesce(
                asset_valuations.estimated_updated_value,
                asset_valuations.face_value,
                0
              ) > 0
          ) as has_valuation,
          exists (
            select 1
            from judicial_processes
            where judicial_processes.tenant_id = precatorio_assets.tenant_id
              and judicial_processes.asset_id = precatorio_assets.id
              and judicial_processes.deleted_at is null
              and judicial_processes.source = 'datajud'
          ) as has_datajud_process,
          exists (
            select 1
            from publications
            where publications.tenant_id = precatorio_assets.tenant_id
              and publications.source = 'djen'
              and (
                publications.asset_id = precatorio_assets.id
                or exists (
                  select 1
                  from judicial_processes
                  where judicial_processes.tenant_id = precatorio_assets.tenant_id
                    and judicial_processes.id = publications.process_id
                    and judicial_processes.asset_id = precatorio_assets.id
                    and judicial_processes.deleted_at is null
                )
              )
          ) as has_djen_publication,
          (
            select count(distinct asset_field_evidences.field_key)
            from asset_field_evidences
            where asset_field_evidences.tenant_id = precatorio_assets.tenant_id
              and asset_field_evidences.asset_id = precatorio_assets.id
              and asset_field_evidences.status = 'resolved'
              and asset_field_evidences.field_key in (
                'cnj_number',
                'debtor_name',
                'court_alias',
                'face_value'
              )
          ) as resolved_core_fields,
          (
            select count(*)
            from asset_field_evidences
            where asset_field_evidences.tenant_id = precatorio_assets.tenant_id
              and asset_field_evidences.asset_id = precatorio_assets.id
              and asset_field_evidences.status = 'conflict'
          ) as field_evidence_conflicts,
          (
            select count(*)
            from asset_source_links
            where asset_source_links.tenant_id = precatorio_assets.tenant_id
              and asset_source_links.asset_id = precatorio_assets.id
              and asset_source_links.link_type = 'conflict'
          ) as source_conflicts,
          (
            select count(*)
            from process_match_candidates
            where process_match_candidates.tenant_id = precatorio_assets.tenant_id
              and process_match_candidates.asset_id = precatorio_assets.id
              and process_match_candidates.status in ('candidate', 'ambiguous')
          ) as pending_candidate_reviews
        from precatorio_assets
        where precatorio_assets.tenant_id = ?
          and precatorio_assets.id = any(?::uuid[])
      `,
      [tenantId, ids]
    )
    const byId = new Map<string, Record<string, unknown>>(
      result.rows.map((row: Record<string, unknown>) => [String(row.id), row])
    )

    for (const asset of assets) {
      asset.dataQuality = buildListDataQuality(asset, byId.get(String(asset.id)))
    }

    return assets
  }

  show(tenantId: string, id: string) {
    return precatorioRepository.showWithDetails(tenantId, id)
  }

  timeline(tenantId: string, id: string) {
    return precatorioTimelineService.build(tenantId, id)
  }
}

function buildListDataQuality(
  asset: Record<string, any>,
  row: Record<string, unknown> | undefined
): PrecatorioListDataQuality {
  const hasValuation = booleanFrom(row?.has_valuation)
  const hasDataJudProcess = booleanFrom(row?.has_datajud_process)
  const hasDjenPublication = booleanFrom(row?.has_djen_publication)
  const resolvedCoreFields = numberFrom(row?.resolved_core_fields)
  const fieldEvidenceConflicts = numberFrom(row?.field_evidence_conflicts)
  const sourceConflicts = numberFrom(row?.source_conflicts)
  const pendingCandidateReviews = numberFrom(row?.pending_candidate_reviews)
  const hasValue = hasValuation && numberFrom(asset.faceValue) > 0
  const issues: string[] = []

  if (!hasValue) issues.push('missing_value')
  if (!hasDataJudProcess) issues.push('missing_datajud')
  if (!hasDjenPublication) issues.push('missing_djen')
  if (resolvedCoreFields < 4) issues.push('missing_field_evidence')
  if (sourceConflicts > 0 || fieldEvidenceConflicts > 0) issues.push('conflicts')
  if (pendingCandidateReviews > 0) issues.push('candidate_review')

  const hasBlocker =
    sourceConflicts > 0 || fieldEvidenceConflicts > 0 || pendingCandidateReviews > 0

  return {
    status: hasBlocker ? 'blocked' : issues.length === 0 ? 'complete' : 'review',
    issues,
    hasValuation,
    hasDataJudProcess,
    hasDjenPublication,
    resolvedCoreFields,
    fieldEvidenceConflicts,
    sourceConflicts,
    pendingCandidateReviews,
  }
}

function booleanFrom(value: unknown) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function numberFrom(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export default new PrecatorioService()
