import { DateTime } from 'luxon'
import GovernmentSourceTarget from '#modules/integrations/models/government_source_target'
import coverageRunService from '#modules/integrations/services/coverage_run_service'
import dataJudNationalPrecatorioSyncService from '#modules/integrations/services/datajud_national_precatorio_sync_service'
import djenPublicationSyncService from '#modules/integrations/services/djen_publication_sync_service'
import genericTribunalPublicSourceAdapter from '#modules/integrations/services/generic_tribunal_public_source_adapter'
import genericTribunalPrecatorioImportService from '#modules/integrations/services/generic_tribunal_precatorio_import_service'
import tjbaPrecatorioApiAdapter from '#modules/integrations/services/tjba_precatorio_api_adapter'
import tjbaPrecatorioImportService from '#modules/integrations/services/tjba_precatorio_import_service'
import tjrjAnnualMapImportService from '#modules/integrations/services/tjrj_annual_map_import_service'
import tjspPrecatorioSyncService from '#modules/integrations/services/tjsp_precatorio_sync_service'
import trf1PrecatorioAdapter, {
  type Trf1PrecatorioLinkKind,
} from '#modules/integrations/services/trf1_precatorio_adapter'
import trf1PrecatorioImportService from '#modules/integrations/services/trf1_precatorio_import_service'
import trf2PrecatorioAdapter from '#modules/integrations/services/trf2_precatorio_adapter'
import trf2PrecatorioImportService from '#modules/integrations/services/trf2_precatorio_import_service'
import trf3PrecatorioAdapter, {
  type Trf3PrecatorioFileFormat,
} from '#modules/integrations/services/trf3_precatorio_adapter'
import trf3PrecatorioImportService from '#modules/integrations/services/trf3_precatorio_import_service'
import trf4PrecatorioAdapter from '#modules/integrations/services/trf4_precatorio_adapter'
import trf4PrecatorioImportService from '#modules/integrations/services/trf4_precatorio_import_service'
import trf5PrecatorioAdapter, {
  type Trf5PrecatorioLinkKind,
} from '#modules/integrations/services/trf5_precatorio_adapter'
import trf5PrecatorioImportService from '#modules/integrations/services/trf5_precatorio_import_service'
import trf6PrecatorioAdapter from '#modules/integrations/services/trf6_precatorio_adapter'
import trf6PrecatorioImportService from '#modules/integrations/services/trf6_precatorio_import_service'
import SourceDataset from '#modules/integrations/models/source_dataset'
import type { TjspPrecatorioCommunicationCategory } from '#modules/integrations/services/tjsp_precatorio_communications_adapter'
import type {
  GovernmentSourceTargetStatus,
  JobRunOrigin,
  JsonRecord,
} from '#shared/types/model_enums'

const TRF5_DEFAULT_KINDS: Trf5PrecatorioLinkKind[] = [
  'paid_precatorios',
  'federal_debt',
  'state_municipal_chronological_order',
  'state_municipal_special_regime_ec94',
  'state_municipal_special_regime_ec136',
]

const TRF5_IMPORTABLE_KINDS = new Set<Trf5PrecatorioLinkKind>([
  'paid_precatorios',
  'federal_debt',
  'state_municipal_chronological_order',
  'state_municipal_special_regime_ec94',
  'state_municipal_special_regime_ec136',
])

export type TribunalSourceSyncOptions = {
  tenantId: string
  targetKeys?: string[] | null
  sourceDatasetKeys?: string[] | null
  courtAliases?: string[] | null
  adapterKeys?: string[] | null
  statuses?: GovernmentSourceTargetStatus[] | null
  limit?: number | null
  dataJudPageSize?: number | null
  dataJudMaxPagesPerCourt?: number | null
  djenSearchTexts?: string[] | null
  djenStartDate?: string | null
  djenEndDate?: string | null
  djenMaxPagesPerCourt?: number | null
  tjspCategories?: TjspPrecatorioCommunicationCategory[] | null
  tjspLimit?: number | null
  tjspImportDocuments?: boolean | null
  genericTribunalLimit?: number | null
  genericTribunalDownloadLinkedDocuments?: boolean | null
  genericTribunalImportLimit?: number | null
  tjbaPageSize?: number | null
  tjbaMaxPages?: number | null
  tjbaImportLimit?: number | null
  tjrjAnnualMapImportLimit?: number | null
  trf1Years?: number[] | null
  trf1Kinds?: Trf1PrecatorioLinkKind[] | null
  trf1Limit?: number | null
  trf1ImportLimit?: number | null
  trf1ImportChunkSize?: number | null
  trf2Years?: number[] | null
  trf3Years?: number[] | null
  trf3Months?: number[] | null
  trf3Formats?: Trf3PrecatorioFileFormat[] | null
  trf3Limit?: number | null
  trf3ImportLimit?: number | null
  trf3ImportChunkSize?: number | null
  trf4ImportLimit?: number | null
  trf4ImportChunkSize?: number | null
  trf5Years?: number[] | null
  trf5Kinds?: Trf5PrecatorioLinkKind[] | null
  trf5Limit?: number | null
  trf5ImportLimit?: number | null
  trf5ImportChunkSize?: number | null
  trf6Years?: number[] | null
  trf6Limit?: number | null
  trf6ImportLimit?: number | null
  trf6ImportChunkSize?: number | null
  dryRun?: boolean
  origin?: JobRunOrigin
}

type TargetResult = {
  targetKey: string
  adapterKey: string | null
  status: 'completed' | 'failed' | 'skipped'
  discoveredCount: number
  sourceRecordsCount: number
  createdAssetsCount: number
  linkedAssetsCount: number
  enrichedAssetsCount: number
  errorCount: number
  message: string | null
  metrics: JsonRecord
}

class TribunalSourceSyncService {
  async sync(options: TribunalSourceSyncOptions) {
    const targets = await this.findTargets(options)

    if (options.dryRun) {
      return {
        dryRun: true,
        selectedTargets: targets.length,
        targets: targets.map((target) => describeTarget(target)),
      }
    }

    const results: TargetResult[] = []

    for (const target of targets) {
      results.push(await this.syncTarget(target, options))
    }

    return {
      dryRun: false,
      selectedTargets: targets.length,
      totals: sumResults(results),
      results,
    }
  }

  private async findTargets(options: TribunalSourceSyncOptions) {
    const query = GovernmentSourceTarget.query().where('is_active', true).preload('sourceDataset')

    if (options.targetKeys?.length) {
      query.whereIn('key', normalizeList(options.targetKeys))
    }

    if (options.courtAliases?.length) {
      query.whereIn('court_alias', normalizeList(options.courtAliases))
    }

    if (options.adapterKeys?.length) {
      query.whereIn('adapter_key', normalizeList(options.adapterKeys))
    }

    if (options.statuses?.length) {
      query.whereIn('status', options.statuses)
    }

    if (options.sourceDatasetKeys?.length) {
      const datasetIds = await this.sourceDatasetIds(options.sourceDatasetKeys)
      query.whereIn('source_dataset_id', datasetIds)
    }

    query.orderByRaw(`
      case priority
        when 'primary' then 1
        when 'enrichment' then 2
        else 3
      end
    `)
    query.orderBy('court_alias', 'asc')
    query.orderBy('key', 'asc')

    if (options.limit && options.limit > 0) {
      query.limit(Math.trunc(options.limit))
    }

    return query.exec()
  }

  private async sourceDatasetIds(keys: string[]) {
    const datasets = await SourceDataset.query().whereIn('key', normalizeList(keys)).select('id')
    return datasets.map((dataset) => dataset.id)
  }

  private async syncTarget(target: GovernmentSourceTarget, options: TribunalSourceSyncOptions) {
    const coverageRun = await coverageRunService.start({
      tenantId: options.tenantId,
      sourceDatasetId: target.sourceDatasetId,
      origin: options.origin ?? 'system',
      scope: {
        targetKey: target.key,
        courtAlias: target.courtAlias,
        adapterKey: target.adapterKey,
        status: target.status,
      },
    })

    try {
      const result = await this.executeTarget(target, options)

      await coverageRunService.finish(coverageRun, result.status, {
        discoveredCount: result.discoveredCount,
        sourceRecordsCount: result.sourceRecordsCount,
        createdAssetsCount: result.createdAssetsCount,
        linkedAssetsCount: result.linkedAssetsCount,
        enrichedAssetsCount: result.enrichedAssetsCount,
        errorCount: result.errorCount,
        metrics: result.metrics,
      })
      await this.persistTargetResult(target, result)

      return result
    } catch (error) {
      const result = failedResult(target, error)

      await coverageRunService.finish(coverageRun, 'failed', {
        error,
        errorCount: 1,
        metrics: result.metrics,
      })
      await this.persistTargetResult(target, result)

      return result
    }
  }

  private async executeTarget(
    target: GovernmentSourceTarget,
    options: TribunalSourceSyncOptions
  ): Promise<TargetResult> {
    if (target.status === 'disabled' || !target.adapterKey) {
      return skippedResult(target, 'No executable adapter is configured for this source target.')
    }

    if (target.status !== 'implemented' && target.status !== 'generic_supported') {
      return skippedResult(target, `Target status ${target.status} requires manual adapter work.`)
    }

    if (target.adapterKey === 'datajud_precatorio_discovery') {
      return this.syncDataJudTarget(target, options)
    }

    if (target.adapterKey === 'djen_publication_sync') {
      return this.syncDjenTarget(target, options)
    }

    if (target.adapterKey === 'tjsp_precatorio_sync') {
      return this.syncTjspTarget(target, options)
    }

    if (target.adapterKey === 'tjba_precatorio_api_sync') {
      return this.syncTjbaTarget(target, options)
    }

    if (target.adapterKey === 'generic_tribunal_public_source_sync') {
      return this.syncGenericTribunalPublicSourceTarget(target, options)
    }

    if (target.adapterKey === 'trf1_precatorio_sync') {
      return this.syncTrf1Target(target, options)
    }

    if (target.adapterKey === 'trf2_precatorio_sync') {
      return this.syncTrf2Target(target, options)
    }

    if (target.adapterKey === 'trf3_precatorio_sync') {
      return this.syncTrf3Target(target, options)
    }

    if (target.adapterKey === 'trf4_precatorio_sync') {
      return this.syncTrf4Target(target, options)
    }

    if (target.adapterKey === 'trf5_precatorio_sync') {
      return this.syncTrf5Target(target, options)
    }

    if (target.adapterKey === 'trf6_precatorio_sync') {
      return this.syncTrf6Target(target, options)
    }

    return skippedResult(target, `Unknown adapter key ${target.adapterKey}.`)
  }

  private async syncDataJudTarget(
    target: GovernmentSourceTarget,
    options: TribunalSourceSyncOptions
  ): Promise<TargetResult> {
    if (!target.courtAlias) {
      return skippedResult(target, 'DataJud target has no court alias.')
    }

    const result = await dataJudNationalPrecatorioSyncService.sync({
      tenantId: options.tenantId,
      courtAliases: [target.courtAlias],
      pageSize: options.dataJudPageSize ?? 100,
      maxPagesPerCourt: options.dataJudMaxPagesPerCourt ?? 1,
      origin: options.origin ?? 'system',
    })

    return completedResult(target, {
      discoveredCount: result.totals.hits,
      sourceRecordsCount: result.totals.pages,
      createdAssetsCount: result.totals.created,
      linkedAssetsCount: result.totals.persisted,
      enrichedAssetsCount: result.totals.updated,
      errorCount: result.totals.errors,
      metrics: result as unknown as JsonRecord,
    })
  }

  private async syncDjenTarget(
    target: GovernmentSourceTarget,
    options: TribunalSourceSyncOptions
  ): Promise<TargetResult> {
    if (!target.courtAlias) {
      return skippedResult(target, 'DJEN target has no court alias.')
    }

    const result = await djenPublicationSyncService.sync({
      tenantId: options.tenantId,
      courtAliases: [target.courtAlias],
      searchTexts: options.djenSearchTexts,
      startDate: options.djenStartDate,
      endDate: options.djenEndDate,
      maxPagesPerCourt: options.djenMaxPagesPerCourt ?? 1,
      origin: options.origin ?? 'system',
    })

    return completedResult(target, {
      discoveredCount: result.totals.count,
      sourceRecordsCount: result.totals.sourceRecordsCreated + result.totals.sourceRecordsReused,
      createdAssetsCount: result.totals.processesCreated,
      linkedAssetsCount: result.totals.linkedAssets,
      enrichedAssetsCount: result.totals.publicationsCreated + result.totals.publicationsUpdated,
      errorCount: result.totals.errors,
      metrics: result as unknown as JsonRecord,
    })
  }

  private async syncTjspTarget(
    target: GovernmentSourceTarget,
    options: TribunalSourceSyncOptions
  ): Promise<TargetResult> {
    const result = await tjspPrecatorioSyncService.sync({
      tenantId: options.tenantId,
      categories: options.tjspCategories,
      limit: options.tjspLimit ?? 25,
      importDocuments: options.tjspImportDocuments ?? true,
      origin: options.origin ?? 'system',
    })

    return completedResult(target, {
      discoveredCount: result.discovered,
      sourceRecordsCount: result.sourceRecordsPersisted,
      createdAssetsCount: result.assetsInserted,
      linkedAssetsCount: result.assetsInserted + result.assetsUpdated,
      enrichedAssetsCount: result.importedDocuments,
      errorCount: result.errors,
      metrics: result as unknown as JsonRecord,
    })
  }

  private async syncTjbaTarget(
    target: GovernmentSourceTarget,
    options: TribunalSourceSyncOptions
  ): Promise<TargetResult> {
    const syncResult = await tjbaPrecatorioApiAdapter.sync({
      tenantId: options.tenantId,
      pageSize: options.tjbaPageSize ?? 200,
      maxPages: options.tjbaMaxPages ?? 1,
    })
    const imports: Awaited<ReturnType<typeof tjbaPrecatorioImportService.importSourceRecord>>[] = []

    for (const sourceRecord of syncResult.sourceRecords) {
      imports.push(
        await tjbaPrecatorioImportService.importSourceRecord(sourceRecord.id, {
          maxRows: options.tjbaImportLimit,
        })
      )
    }

    const importTotals = imports.reduce(
      (totals, item) => ({
        inserted: totals.inserted + item.stats.inserted,
        updated: totals.updated + item.stats.updated,
        errors: totals.errors + item.stats.errors,
        validRows: totals.validRows + item.stats.validRows,
        selectedRows: totals.selectedRows + item.stats.selectedRows,
      }),
      { inserted: 0, updated: 0, errors: 0, validRows: 0, selectedRows: 0 }
    )

    return completedResult(target, {
      discoveredCount: syncResult.totalElements,
      sourceRecordsCount: syncResult.pagesFetched,
      createdAssetsCount: importTotals.inserted,
      linkedAssetsCount: importTotals.inserted + importTotals.updated,
      enrichedAssetsCount: imports.length,
      errorCount: importTotals.errors,
      metrics: {
        ...syncResult,
        sourceRecords: syncResult.sourceRecords.map((sourceRecord) => ({
          id: sourceRecord.id,
          sourceUrl: sourceRecord.sourceUrl,
          createdAt: sourceRecord.createdAt?.toISO?.() ?? null,
        })),
        imports: imports.map((item) => ({
          sourceRecordId: item.sourceRecord.id,
          stats: item.stats,
        })),
        importTotals,
      } as unknown as JsonRecord,
    })
  }

  private async syncGenericTribunalPublicSourceTarget(
    target: GovernmentSourceTarget,
    options: TribunalSourceSyncOptions
  ): Promise<TargetResult> {
    if (!target.sourceUrl) {
      return skippedResult(target, 'Generic tribunal public source target has no source URL.')
    }

    const result = await genericTribunalPublicSourceAdapter.sync({
      tenantId: options.tenantId,
      target: {
        key: target.key,
        sourceDatasetKey: target.sourceDataset.key,
        name: target.name,
        sourceUrl: target.sourceUrl,
        courtAlias: target.courtAlias,
        stateCode: target.stateCode,
        metadata: target.metadata,
      },
      limit: options.genericTribunalLimit ?? 25,
      nestedLimit: options.genericTribunalLimit ?? 25,
      downloadLinkedDocuments: options.genericTribunalDownloadLinkedDocuments ?? true,
    })
    const tjrjImports =
      target.courtAlias === 'tjrj'
        ? await this.importTjrjAnnualMapSourceRecords(result.items, options)
        : []
    const genericImports = await this.importGenericTribunalSourceRecords(result.items, options)
    const tjrjImportTotals = tjrjImports.reduce(
      (totals, item) => ({
        inserted: totals.inserted + item.stats.inserted,
        updated: totals.updated + item.stats.updated,
        errors: totals.errors + item.stats.errors,
        validRows: totals.validRows + item.stats.validRows,
      }),
      { inserted: 0, updated: 0, errors: 0, validRows: 0 }
    )
    const genericImportTotals = genericImports.reduce(
      (totals, item) => ({
        inserted: totals.inserted + item.stats.inserted,
        updated: totals.updated + item.stats.updated,
        errors: totals.errors + item.stats.errors,
        validRows: totals.validRows + item.stats.validRows,
        selectedRows: totals.selectedRows + item.stats.selectedRows,
      }),
      { inserted: 0, updated: 0, errors: 0, validRows: 0, selectedRows: 0 }
    )

    return completedResult(target, {
      discoveredCount: result.discovered,
      sourceRecordsCount: result.persisted,
      createdAssetsCount: genericImportTotals.inserted,
      linkedAssetsCount: genericImportTotals.inserted + genericImportTotals.updated,
      enrichedAssetsCount: result.sourceRecordsCreated + tjrjImports.length + genericImports.length,
      errorCount: tjrjImportTotals.errors + genericImportTotals.errors,
      metrics: {
        ...result,
        tjrjAnnualMapImports: tjrjImports.map((item) => ({
          sourceRecordId: item.sourceRecord.id,
          stats: item.stats,
          extraction: {
            format: item.extraction.format,
            status: item.extraction.status,
            rows: item.extraction.rows.length,
            errors: item.extraction.errors,
          },
        })),
        genericPrecatorioImports: genericImports.map((item) => ({
          sourceRecordId: item.sourceRecord.id,
          stats: item.stats,
          extraction: {
            format: item.extraction.format,
            status: item.extraction.status,
            rows: item.extraction.rows.length,
            errors: item.extraction.errors,
          },
        })),
        tjrjImportTotals,
        genericImportTotals,
      } as unknown as JsonRecord,
    })
  }

  private async importTjrjAnnualMapSourceRecords(
    items: Array<{ link: { title: string; url: string; format: string }; sourceRecordId: string }>,
    options: TribunalSourceSyncOptions
  ) {
    const imports: Awaited<ReturnType<typeof tjrjAnnualMapImportService.importSourceRecord>>[] = []

    for (const item of items) {
      if (!isTjrjAnnualMapDocument(item.link)) {
        continue
      }

      imports.push(
        await tjrjAnnualMapImportService.importSourceRecord(item.sourceRecordId, {
          maxRows: options.tjrjAnnualMapImportLimit,
        })
      )
    }

    return imports
  }

  private async importGenericTribunalSourceRecords(
    items: Array<{ sourceRecordId: string }>,
    options: TribunalSourceSyncOptions
  ) {
    const imports: Awaited<
      ReturnType<typeof genericTribunalPrecatorioImportService.importSourceRecord>
    >[] = []

    for (const item of items) {
      imports.push(
        await genericTribunalPrecatorioImportService.importSourceRecord(item.sourceRecordId, {
          maxRows: options.genericTribunalImportLimit,
        })
      )
    }

    return imports
  }

  private async syncTrf1Target(
    target: GovernmentSourceTarget,
    options: TribunalSourceSyncOptions
  ): Promise<TargetResult> {
    const syncResult = await trf1PrecatorioAdapter.sync({
      tenantId: options.tenantId,
      years: options.trf1Years ?? undefined,
      kinds: options.trf1Kinds ?? undefined,
      limit: options.trf1Limit ?? 25,
      download: true,
    })
    const imports: Awaited<ReturnType<typeof trf1PrecatorioImportService.importSourceRecord>>[] = []

    for (const item of syncResult.items) {
      if (!item.sourceRecord) {
        continue
      }

      imports.push(
        await trf1PrecatorioImportService.importSourceRecord(item.sourceRecord.id, {
          maxRows: options.trf1ImportLimit,
          chunkSize: options.trf1ImportChunkSize,
        })
      )
    }

    const importTotals = imports.reduce(
      (totals, item) => ({
        inserted: totals.inserted + item.stats.inserted,
        updated: totals.updated + item.stats.updated,
        errors: totals.errors + item.stats.errors,
        validRows: totals.validRows + item.stats.validRows,
        selectedRows: totals.selectedRows + item.stats.selectedRows,
        processedBatches: totals.processedBatches + item.chunking.processedBatches,
      }),
      { inserted: 0, updated: 0, errors: 0, validRows: 0, selectedRows: 0, processedBatches: 0 }
    )

    return completedResult(target, {
      discoveredCount: syncResult.discovered,
      sourceRecordsCount: syncResult.downloaded,
      createdAssetsCount: importTotals.inserted,
      linkedAssetsCount: importTotals.inserted + importTotals.updated,
      enrichedAssetsCount: imports.length,
      errorCount: importTotals.errors,
      metrics: {
        ...syncResult,
        items: syncResult.items.map((item) => ({
          link: item.link,
          sourceRecordId: item.sourceRecord?.id ?? null,
          sourceRecordCreated: item.sourceRecordCreated ?? false,
        })),
        imports: imports.map((item) => ({
          sourceRecordId: item.sourceRecord.id,
          stats: item.stats,
          chunking: item.chunking,
          extraction: {
            format: item.extraction.format,
            status: item.extraction.status,
            rows: item.extraction.rows.length,
            errors: item.extraction.errors,
          },
        })),
        importTotals,
      },
    })
  }

  private async syncTrf2Target(
    target: GovernmentSourceTarget,
    options: TribunalSourceSyncOptions
  ): Promise<TargetResult> {
    const syncResult = await trf2PrecatorioAdapter.sync({
      tenantId: options.tenantId,
      years: options.trf2Years ?? undefined,
      download: true,
    })
    const imports: Awaited<ReturnType<typeof trf2PrecatorioImportService.importSourceRecord>>[] = []

    for (const item of syncResult.items) {
      if (!item.sourceRecord || item.link.kind !== 'paid_precatorios') {
        continue
      }

      imports.push(await trf2PrecatorioImportService.importSourceRecord(item.sourceRecord.id))
    }

    const importTotals = imports.reduce(
      (totals, item) => ({
        inserted: totals.inserted + item.stats.inserted,
        updated: totals.updated + item.stats.updated,
        errors: totals.errors + item.stats.errors,
        validRows: totals.validRows + item.stats.validRows,
      }),
      { inserted: 0, updated: 0, errors: 0, validRows: 0 }
    )

    return completedResult(target, {
      discoveredCount: syncResult.discovered,
      sourceRecordsCount: syncResult.downloaded,
      createdAssetsCount: importTotals.inserted,
      linkedAssetsCount: importTotals.inserted + importTotals.updated,
      enrichedAssetsCount: imports.length,
      errorCount: importTotals.errors,
      metrics: {
        ...syncResult,
        imports: imports.map((item) => ({
          sourceRecordId: item.sourceRecord.id,
          stats: item.stats,
        })),
        importTotals,
      },
    })
  }

  private async syncTrf3Target(
    target: GovernmentSourceTarget,
    options: TribunalSourceSyncOptions
  ): Promise<TargetResult> {
    const syncResult = await trf3PrecatorioAdapter.sync({
      tenantId: options.tenantId,
      years: options.trf3Years ?? undefined,
      months: options.trf3Months ?? undefined,
      formats: options.trf3Formats ?? ['csv', 'xlsx'],
      limit: options.trf3Limit ?? 12,
      download: true,
    })
    const imports: Awaited<ReturnType<typeof trf3PrecatorioImportService.importSourceRecord>>[] = []

    for (const item of syncResult.items) {
      if (!item.sourceRecord || item.link.format === 'pdf') {
        continue
      }

      imports.push(
        await trf3PrecatorioImportService.importSourceRecord(item.sourceRecord.id, {
          maxRows: options.trf3ImportLimit,
          chunkSize: options.trf3ImportChunkSize,
        })
      )
    }

    const importTotals = imports.reduce(
      (totals, item) => ({
        inserted: totals.inserted + item.stats.inserted,
        updated: totals.updated + item.stats.updated,
        errors: totals.errors + item.stats.errors,
        validRows: totals.validRows + item.stats.validRows,
        selectedRows: totals.selectedRows + item.stats.selectedRows,
        processedBatches: totals.processedBatches + item.chunking.processedBatches,
        budgetExecutionInserted:
          totals.budgetExecutionInserted + item.stats.budgetExecutionInserted,
        budgetExecutionUpdated: totals.budgetExecutionUpdated + item.stats.budgetExecutionUpdated,
      }),
      {
        inserted: 0,
        updated: 0,
        errors: 0,
        validRows: 0,
        selectedRows: 0,
        processedBatches: 0,
        budgetExecutionInserted: 0,
        budgetExecutionUpdated: 0,
      }
    )

    return completedResult(target, {
      discoveredCount: syncResult.discovered,
      sourceRecordsCount: syncResult.downloaded,
      createdAssetsCount: importTotals.inserted,
      linkedAssetsCount: importTotals.inserted + importTotals.updated,
      enrichedAssetsCount: imports.length,
      errorCount: importTotals.errors,
      metrics: {
        ...syncResult,
        items: syncResult.items.map((item) => ({
          link: item.link,
          sourceRecordId: item.sourceRecord?.id ?? null,
          sourceRecordCreated: item.sourceRecordCreated ?? false,
        })),
        imports: imports.map((item) => ({
          sourceRecordId: item.sourceRecord.id,
          stats: item.stats,
          chunking: item.chunking,
          extraction: {
            format: item.extraction.format,
            status: item.extraction.status,
            rows: item.extraction.rows.length,
            errors: item.extraction.errors,
          },
        })),
        importTotals,
      },
    })
  }

  private async syncTrf4Target(
    target: GovernmentSourceTarget,
    options: TribunalSourceSyncOptions
  ): Promise<TargetResult> {
    const syncResult = await trf4PrecatorioAdapter.sync({
      tenantId: options.tenantId,
      download: true,
    })
    const imports: Awaited<ReturnType<typeof trf4PrecatorioImportService.importSourceRecord>>[] = []

    for (const item of syncResult.items) {
      if (!item.sourceRecord) {
        continue
      }

      imports.push(
        await trf4PrecatorioImportService.importSourceRecord(item.sourceRecord.id, {
          maxGroups: options.trf4ImportLimit,
          chunkSize: options.trf4ImportChunkSize,
        })
      )
    }

    const importTotals = imports.reduce(
      (totals, item) => ({
        inserted: totals.inserted + item.stats.inserted,
        updated: totals.updated + item.stats.updated,
        errors: totals.errors + item.stats.errors,
        validRows: totals.validRows + item.stats.validRows,
        groupedPrecatorios: totals.groupedPrecatorios + item.stats.groupedPrecatorios,
        processedBatches: totals.processedBatches + item.chunking.processedBatches,
      }),
      {
        inserted: 0,
        updated: 0,
        errors: 0,
        validRows: 0,
        groupedPrecatorios: 0,
        processedBatches: 0,
      }
    )

    return completedResult(target, {
      discoveredCount: syncResult.discovered,
      sourceRecordsCount: syncResult.downloaded,
      createdAssetsCount: importTotals.inserted,
      linkedAssetsCount: importTotals.inserted + importTotals.updated,
      enrichedAssetsCount: imports.length,
      errorCount: importTotals.errors,
      metrics: {
        ...syncResult,
        imports: imports.map((item) => ({
          sourceRecordId: item.sourceRecord.id,
          stats: item.stats,
          chunking: item.chunking,
        })),
        importTotals,
      },
    })
  }

  private async syncTrf5Target(
    target: GovernmentSourceTarget,
    options: TribunalSourceSyncOptions
  ): Promise<TargetResult> {
    const syncResult = await trf5PrecatorioAdapter.sync({
      tenantId: options.tenantId,
      years: options.trf5Years ?? undefined,
      kinds: options.trf5Kinds ?? TRF5_DEFAULT_KINDS,
      limit: options.trf5Limit ?? 10,
      download: true,
    })
    const imports: Awaited<ReturnType<typeof trf5PrecatorioImportService.importSourceRecord>>[] = []

    for (const item of syncResult.items) {
      if (!item.sourceRecord || !TRF5_IMPORTABLE_KINDS.has(item.link.kind)) {
        continue
      }

      imports.push(
        await trf5PrecatorioImportService.importSourceRecord(item.sourceRecord.id, {
          maxRows: options.trf5ImportLimit,
          chunkSize: options.trf5ImportChunkSize,
        })
      )
    }

    const importTotals = imports.reduce(
      (totals, item) => ({
        inserted: totals.inserted + item.stats.inserted,
        updated: totals.updated + item.stats.updated,
        errors: totals.errors + item.stats.errors,
        validRows: totals.validRows + item.stats.validRows,
        selectedRows: totals.selectedRows + item.stats.selectedRows,
        processedBatches: totals.processedBatches + item.chunking.processedBatches,
      }),
      { inserted: 0, updated: 0, errors: 0, validRows: 0, selectedRows: 0, processedBatches: 0 }
    )

    return completedResult(target, {
      discoveredCount: syncResult.discovered,
      sourceRecordsCount: syncResult.downloaded,
      createdAssetsCount: importTotals.inserted,
      linkedAssetsCount: importTotals.inserted + importTotals.updated,
      enrichedAssetsCount: imports.length,
      errorCount: importTotals.errors,
      metrics: {
        ...syncResult,
        imports: imports.map((item) => ({
          sourceRecordId: item.sourceRecord.id,
          stats: item.stats,
          chunking: item.chunking,
          extraction: {
            format: item.extraction.format,
            status: item.extraction.status,
            rows: item.extraction.rows.length,
            errors: item.extraction.errors,
          },
        })),
        importTotals,
      },
    })
  }

  private async syncTrf6Target(
    target: GovernmentSourceTarget,
    options: TribunalSourceSyncOptions
  ): Promise<TargetResult> {
    const syncResult = await trf6PrecatorioAdapter.sync({
      tenantId: options.tenantId,
      years: options.trf6Years ?? undefined,
      limit: options.trf6Limit ?? 10,
      download: true,
    })
    const imports: Awaited<ReturnType<typeof trf6PrecatorioImportService.importSourceRecord>>[] = []

    for (const item of syncResult.items) {
      if (!item.sourceRecord) {
        continue
      }

      imports.push(
        await trf6PrecatorioImportService.importSourceRecord(item.sourceRecord.id, {
          maxRows: options.trf6ImportLimit,
          chunkSize: options.trf6ImportChunkSize,
        })
      )
    }

    const importTotals = imports.reduce(
      (totals, item) => ({
        inserted: totals.inserted + item.stats.inserted,
        updated: totals.updated + item.stats.updated,
        errors: totals.errors + item.stats.errors,
        validRows: totals.validRows + item.stats.validRows,
        selectedRows: totals.selectedRows + item.stats.selectedRows,
        processedBatches: totals.processedBatches + item.chunking.processedBatches,
      }),
      { inserted: 0, updated: 0, errors: 0, validRows: 0, selectedRows: 0, processedBatches: 0 }
    )

    return completedResult(target, {
      discoveredCount: syncResult.discovered,
      sourceRecordsCount: syncResult.downloaded,
      createdAssetsCount: importTotals.inserted,
      linkedAssetsCount: importTotals.inserted + importTotals.updated,
      enrichedAssetsCount: imports.length,
      errorCount: importTotals.errors,
      metrics: {
        ...syncResult,
        imports: imports.map((item) => ({
          sourceRecordId: item.sourceRecord.id,
          stats: item.stats,
          chunking: item.chunking,
          extraction: {
            format: item.extraction.format,
            status: item.extraction.status,
            rows: item.extraction.rows.length,
            errors: item.extraction.errors,
          },
        })),
        importTotals,
      },
    })
  }

  private async persistTargetResult(target: GovernmentSourceTarget, result: TargetResult) {
    if (result.status === 'skipped') {
      target.merge({
        lastDiscoveredCount: result.discoveredCount,
        lastSourceRecordsCount: result.sourceRecordsCount,
      })
      await target.save()
      return
    }

    target.merge({
      lastSuccessAt: result.status === 'completed' ? DateTime.utc() : target.lastSuccessAt,
      lastErrorAt: result.status === 'failed' ? DateTime.utc() : null,
      lastErrorMessage: result.status === 'failed' ? result.message : null,
      lastDiscoveredCount: result.discoveredCount,
      lastSourceRecordsCount: result.sourceRecordsCount,
      coverageScore: coverageScoreFor(result),
    })
    await target.save()
  }
}

function describeTarget(target: GovernmentSourceTarget) {
  return {
    key: target.key,
    name: target.name,
    source: target.source,
    courtAlias: target.courtAlias,
    stateCode: target.stateCode,
    priority: target.priority,
    status: target.status,
    adapterKey: target.adapterKey,
    sourceUrl: target.sourceUrl,
    sourceFormat: target.sourceFormat,
  }
}

function completedResult(
  target: GovernmentSourceTarget,
  input: Omit<TargetResult, 'targetKey' | 'adapterKey' | 'status' | 'message'>
): TargetResult {
  return {
    targetKey: target.key,
    adapterKey: target.adapterKey,
    status: 'completed',
    message: null,
    ...input,
  }
}

function skippedResult(target: GovernmentSourceTarget, message: string): TargetResult {
  return {
    targetKey: target.key,
    adapterKey: target.adapterKey,
    status: 'skipped',
    discoveredCount: 0,
    sourceRecordsCount: 0,
    createdAssetsCount: 0,
    linkedAssetsCount: 0,
    enrichedAssetsCount: 0,
    errorCount: 0,
    message,
    metrics: { message },
  }
}

function failedResult(target: GovernmentSourceTarget, error: unknown): TargetResult {
  const message = error instanceof Error ? error.message : String(error)

  return {
    targetKey: target.key,
    adapterKey: target.adapterKey,
    status: 'failed',
    discoveredCount: 0,
    sourceRecordsCount: 0,
    createdAssetsCount: 0,
    linkedAssetsCount: 0,
    enrichedAssetsCount: 0,
    errorCount: 1,
    message,
    metrics: { message },
  }
}

function sumResults(results: TargetResult[]) {
  return results.reduce(
    (totals, result) => ({
      completed: totals.completed + (result.status === 'completed' ? 1 : 0),
      skipped: totals.skipped + (result.status === 'skipped' ? 1 : 0),
      failed: totals.failed + (result.status === 'failed' ? 1 : 0),
      discoveredCount: totals.discoveredCount + result.discoveredCount,
      sourceRecordsCount: totals.sourceRecordsCount + result.sourceRecordsCount,
      createdAssetsCount: totals.createdAssetsCount + result.createdAssetsCount,
      linkedAssetsCount: totals.linkedAssetsCount + result.linkedAssetsCount,
      enrichedAssetsCount: totals.enrichedAssetsCount + result.enrichedAssetsCount,
      errorCount: totals.errorCount + result.errorCount,
    }),
    {
      completed: 0,
      skipped: 0,
      failed: 0,
      discoveredCount: 0,
      sourceRecordsCount: 0,
      createdAssetsCount: 0,
      linkedAssetsCount: 0,
      enrichedAssetsCount: 0,
      errorCount: 0,
    }
  )
}

function coverageScoreFor(result: TargetResult) {
  if (result.status === 'failed') {
    return '0.0000'
  }

  if (result.errorCount > 0) {
    return '0.5000'
  }

  if (result.sourceRecordsCount > 0 || result.linkedAssetsCount > 0) {
    return '1.0000'
  }

  return result.discoveredCount > 0 ? '0.7500' : '0.2500'
}

function normalizeList(values: string[]) {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))]
}

function isTjrjAnnualMapDocument(link: { title: string; url: string; format: string }) {
  const value = `${link.title} ${link.url}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  return link.format === 'pdf' && value.includes('mapa') && value.includes('precatorio')
}

export default new TribunalSourceSyncService()
