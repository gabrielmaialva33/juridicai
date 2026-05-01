import BaseRepository from '#shared/repositories/base_repository'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import type {
  AssetNature,
  ComplianceStatus,
  LifecycleStatus,
  SourceType,
} from '#shared/types/model_enums'

export type PrecatorioListFilters = {
  page: number
  limit: number
  q?: string | null
  debtorId?: string | null
  source?: SourceType | null
  nature?: AssetNature | null
  lifecycleStatus?: LifecycleStatus | null
  complianceStatus?: ComplianceStatus | null
  exerciseYearFrom?: number | null
  exerciseYearTo?: number | null
  minFaceValue?: number | null
  maxFaceValue?: number | null
  sortBy: 'created_at' | 'face_value' | 'exercise_year' | 'current_score'
  sortDirection: 'asc' | 'desc'
}

class PrecatorioRepository extends BaseRepository<typeof PrecatorioAsset> {
  constructor() {
    super(PrecatorioAsset)
  }

  list(tenantId: string, filters: PrecatorioListFilters) {
    const query = this.query(tenantId)
      .preload('debtor')
      .preload('valuations', (valuationQuery) =>
        valuationQuery.orderBy('computed_at', 'desc').limit(1)
      )

    if (filters.q) {
      const term = `%${filters.q.toLowerCase()}%`
      query.where((builder) => {
        builder
          .whereRaw('lower(coalesce(cnj_number, ?)) like ?', ['', term])
          .orWhereRaw('lower(coalesce(external_id, ?)) like ?', ['', term])
          .orWhereRaw('lower(coalesce(asset_number, ?)) like ?', ['', term])
      })
    }

    if (filters.debtorId) query.where('debtor_id', filters.debtorId)
    if (filters.source) query.where('source', filters.source)
    if (filters.nature) query.where('nature', filters.nature)
    if (filters.lifecycleStatus) query.where('lifecycle_status', filters.lifecycleStatus)
    if (filters.complianceStatus) query.where('compliance_status', filters.complianceStatus)
    if (filters.exerciseYearFrom) query.where('exercise_year', '>=', filters.exerciseYearFrom)
    if (filters.exerciseYearTo) query.where('exercise_year', '<=', filters.exerciseYearTo)
    if (filters.minFaceValue) {
      query.whereRaw(`${latestValueSql()} >= ?`, [filters.minFaceValue])
    }
    if (filters.maxFaceValue) {
      query.whereRaw(`${latestValueSql()} <= ?`, [filters.maxFaceValue])
    }

    return query
      .if(filters.sortBy === 'face_value', (builder) =>
        builder.orderByRaw(`${latestValueSql()} ${filters.sortDirection}`)
      )
      .if(filters.sortBy !== 'face_value', (builder) =>
        builder.orderBy(filters.sortBy, filters.sortDirection)
      )
      .orderBy('id', 'asc')
      .paginate(filters.page, filters.limit)
  }

  showWithDetails(tenantId: string, id: string) {
    return this.query(tenantId)
      .where('id', id)
      .preload('debtor')
      .preload('sourceRecord')
      .preload('currentScoreRow')
      .preload('events', (query) => query.orderBy('event_date', 'desc').limit(50))
      .preload('valuations', (query) => query.orderBy('computed_at', 'desc').limit(10))
      .preload('budgetFacts', (query) => query.orderBy('created_at', 'desc').limit(10))
      .preload('scores', (query) => query.orderBy('computed_at', 'desc').limit(20))
      .preload('judicialProcesses', (query) => query.orderBy('created_at', 'desc').limit(20))
      .preload('publications', (query) => query.orderBy('publication_date', 'desc').limit(20))
      .preload('cessionOpportunity')
      .firstOrFail()
  }

  findByExternalId(tenantId: string, externalId: string) {
    return this.query(tenantId).where('external_id', externalId).first()
  }
}

function latestValueSql() {
  return `coalesce((
    select av.estimated_updated_value
    from asset_valuations av
    where av.tenant_id = precatorio_assets.tenant_id
      and av.asset_id = precatorio_assets.id
    order by av.computed_at desc
    limit 1
  ), (
    select av.face_value
    from asset_valuations av
    where av.tenant_id = precatorio_assets.tenant_id
      and av.asset_id = precatorio_assets.id
    order by av.computed_at desc
    limit 1
  ), 0)`
}

export default new PrecatorioRepository()
