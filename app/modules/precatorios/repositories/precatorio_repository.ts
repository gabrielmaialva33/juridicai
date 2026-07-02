import BaseRepository from '#shared/repositories/base_repository'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type {
  AssetNature,
  ComplianceStatus,
  LifecycleStatus,
  SourceType,
} from '#shared/types/model_enums'
import type { PostImportOperationalIntakeOptions } from '#modules/operations/services/post_import_operational_intake_service'

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
        builder.orderByRaw(`${latestValueSql()} ${filters.sortDirection} nulls last`)
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

  listByCnj(tenantId: string, cnjNumber: string, limit = 2) {
    return this.query(tenantId).where('cnj_number', cnjNumber).limit(limit)
  }

  findForSiopImport(
    tenantId: string,
    cnjNumber: string | null,
    externalId: string,
    trx: TransactionClientContract
  ) {
    const query = PrecatorioAsset.query({ client: trx }).where('tenant_id', tenantId)

    if (cnjNumber) {
      query.where((builder) => {
        builder.where('cnj_number', cnjNumber).orWhere('external_id', externalId)
      })
    } else {
      query.where('external_id', externalId)
    }

    return query.first()
  }

  createForSiopImport(payload: Record<string, unknown>, trx: TransactionClientContract) {
    return PrecatorioAsset.create(payload, { client: trx })
  }

  findForSignalScore(tenantId: string, assetId: string) {
    return this.query(tenantId)
      .where('id', assetId)
      .preload('events', (query) => query.orderBy('event_date', 'desc').limit(200))
      .preload('valuations', (query) => query.orderBy('computed_at', 'desc').limit(1))
      .firstOrFail()
  }

  findForTimeline(tenantId: string, assetId: string) {
    return this.query(tenantId)
      .where('id', assetId)
      .preload('debtor')
      .preload('court')
      .preload('budgetUnit')
      .preload('sourceRecord')
      .preload('sourceLinks', (query) =>
        query
          .preload('sourceRecord')
          .preload('sourceDataset')
          .orderBy('last_seen_at', 'desc')
          .limit(50)
      )
      .preload('externalIdentifiers', (query) =>
        query
          .preload('sourceRecord')
          .preload('sourceDataset')
          .orderBy('is_primary', 'desc')
          .orderBy('identifier_type', 'asc')
      )
      .preload('valuations', (query) => query.orderBy('computed_at', 'desc').limit(20))
      .preload('budgetFacts', (query) => query.orderBy('created_at', 'desc').limit(20))
      .preload('events', (query) => query.orderBy('event_date', 'desc').limit(100))
      .preload('scores', (query) => query.orderBy('computed_at', 'desc').limit(20))
      .preload('judicialProcesses', (query) =>
        query
          .preload('sourceRecord')
          .preload('court')
          .preload('judicialClass')
          .preload('judgingBody')
          .preload('subjects')
          .preload('signals', (signalQuery) => signalQuery.orderBy('detected_at', 'desc').limit(50))
          .preload('movements', (movementQuery) =>
            movementQuery.orderBy('occurred_at', 'desc').limit(50)
          )
          .orderBy('created_at', 'desc')
          .limit(20)
      )
      .preload('publications', (query) =>
        query
          .preload('sourceRecord')
          .preload('events', (eventQuery) => eventQuery.orderBy('event_date', 'desc').limit(20))
          .orderBy('publication_date', 'desc')
          .limit(50)
      )
      .preload('cessionOpportunity', (query) => query.preload('currentPricing'))
      .firstOrFail()
  }

  listForCsvExport(tenantId: string, limit: number) {
    return this.query(tenantId)
      .preload('debtor')
      .preload('valuations', (query) => query.orderBy('computed_at', 'desc').limit(1))
      .orderBy('created_at', 'desc')
      .limit(limit)
  }

  listForOpportunityComputation(tenantId: string, limit: number) {
    return this.query(tenantId)
      .preload('debtor', (query) =>
        query.preload('paymentStats', (statsQuery) =>
          statsQuery.orderBy('computed_at', 'desc').limit(1)
        )
      )
      .preload('events', (query) => query.orderBy('event_date', 'desc').limit(50))
      .preload('valuations', (query) => query.orderBy('computed_at', 'desc').limit(1))
      .preload('cessionOpportunity', (query) => query.preload('currentPricing'))
      .orderBy('created_at', 'desc')
      .limit(limit)
  }

  findForOpportunityShow(tenantId: string, assetId: string) {
    return this.query(tenantId)
      .where('id', assetId)
      .preload('debtor', (query) =>
        query.preload('paymentStats', (statsQuery) =>
          statsQuery.orderBy('computed_at', 'desc').limit(1)
        )
      )
      .preload('events', (query) => query.orderBy('event_date', 'desc').limit(100))
      .preload('valuations', (query) => query.orderBy('computed_at', 'desc').limit(1))
      .preload('cessionOpportunity', (query) => query.preload('currentPricing'))
      .preload('judicialProcesses', (query) => query.orderBy('created_at', 'desc').limit(10))
      .preload('publications', (query) => query.orderBy('publication_date', 'desc').limit(10))
      .firstOrFail()
  }

  listForPostImportOperationalIntake(options: PostImportOperationalIntakeOptions) {
    const sourceRecordIds = uniqueIds([
      ...(options.sourceRecordIds ?? []),
      ...(options.sourceRecordId ? [options.sourceRecordId] : []),
    ])
    const query = this.query(options.tenantId)
      .preload('debtor', (debtorQuery) =>
        debtorQuery.preload('paymentStats', (statsQuery) =>
          statsQuery.orderBy('computed_at', 'desc').limit(1)
        )
      )
      .preload('events', (eventQuery) => eventQuery.orderBy('event_date', 'desc').limit(100))
      .preload('valuations', (valuationQuery) =>
        valuationQuery.orderBy('computed_at', 'desc').limit(1)
      )
      .preload('cessionOpportunity', (opportunityQuery) =>
        opportunityQuery.preload('currentPricing')
      )
      .orderBy('created_at', 'desc')
      .limit(normalizeLimit(options.limit))

    if (sourceRecordIds.length > 0) {
      query.whereIn('source_record_id', sourceRecordIds)
    }

    if (options.assetIds?.length) {
      query.whereIn('id', uniqueIds(options.assetIds))
    }

    if (options.source) {
      query.where('source', options.source)
    }

    return query.exec()
  }

  findForIntelligenceDossier(tenantId: string, assetId: string) {
    return this.query(tenantId)
      .where('id', assetId)
      .preload('debtor', (query) =>
        query.preload('paymentStats', (statsQuery) =>
          statsQuery.orderBy('computed_at', 'desc').limit(3)
        )
      )
      .preload('court')
      .preload('budgetUnit')
      .preload('sourceRecord', (query) => query.preload('sourceDataset'))
      .preload('sourceLinks', (query) =>
        query
          .preload('sourceRecord', (sourceQuery) => sourceQuery.preload('sourceDataset'))
          .preload('sourceDataset')
          .orderBy('last_seen_at', 'desc')
          .limit(100)
      )
      .preload('externalIdentifiers', (query) =>
        query
          .preload('sourceRecord', (sourceQuery) => sourceQuery.preload('sourceDataset'))
          .preload('sourceDataset')
          .orderBy('is_primary', 'desc')
          .orderBy('identifier_type', 'asc')
          .limit(100)
      )
      .preload('fieldEvidences', (query) => query.orderBy('field_key', 'asc'))
      .preload('valuations', (query) => query.orderBy('computed_at', 'desc').limit(30))
      .preload('budgetFacts', (query) => query.orderBy('created_at', 'desc').limit(30))
      .preload('events', (query) => query.orderBy('event_date', 'desc').limit(150))
      .preload('scores', (query) => query.orderBy('computed_at', 'desc').limit(30))
      .preload('judicialProcesses', (query) =>
        query
          .preload('sourceRecord', (sourceQuery) => sourceQuery.preload('sourceDataset'))
          .preload('court')
          .preload('judicialClass')
          .preload('judgingBody')
          .preload('subjects')
          .preload('signals', (signalQuery) => signalQuery.orderBy('detected_at', 'desc').limit(80))
          .preload('movements', (movementQuery) =>
            movementQuery.orderBy('occurred_at', 'desc').limit(80)
          )
          .orderBy('created_at', 'desc')
          .limit(30)
      )
      .preload('publications', (query) =>
        query
          .preload('sourceRecord', (sourceQuery) => sourceQuery.preload('sourceDataset'))
          .preload('events', (eventQuery) => eventQuery.orderBy('event_date', 'desc').limit(50))
          .orderBy('publication_date', 'desc')
          .limit(80)
      )
      .preload('cessionOpportunity', (query) => query.preload('currentPricing'))
      .firstOrFail()
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
  ))`
}

function uniqueIds(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function normalizeLimit(value: number | null | undefined) {
  return Math.min(Math.max(value ?? 500, 1), 5_000)
}

export default new PrecatorioRepository()
