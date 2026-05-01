import coverageRunService from '#modules/integrations/services/coverage_run_service'
import tjspPrecatorioCommunicationsAdapter, {
  type TjspPrecatorioCommunicationCategory,
} from '#modules/integrations/services/tjsp_precatorio_communications_adapter'
import tjspPrecatorioDocumentImportService from '#modules/integrations/services/tjsp_precatorio_document_import_service'
import type SourceRecord from '#modules/siop/models/source_record'
import type { JobRunOrigin, JsonRecord } from '#shared/types/model_enums'

export type TjspPrecatorioSyncServiceOptions = {
  tenantId: string
  categories?: TjspPrecatorioCommunicationCategory[] | null
  limit?: number | null
  fetcher?: typeof fetch
  downloadDetails?: boolean
  downloadDocuments?: boolean
  importDocuments?: boolean
  origin?: JobRunOrigin
}

export type TjspPrecatorioDocumentImportMetrics = {
  sourceRecordId: string
  sourceUrl: string | null
  extractedRows: number
  importableRows: number
  inserted: number
  updated: number
  skipped: number
  errors: number
}

export type TjspPrecatorioSyncServiceResult = {
  discovered: number
  selected: number
  sourceRecordsPersisted: number
  communicationSourceRecords: number
  documentSourceRecords: number
  documentLinks: number
  importedDocuments: number
  extractedRows: number
  importableRows: number
  assetsInserted: number
  assetsUpdated: number
  skippedRows: number
  errors: number
  imports: TjspPrecatorioDocumentImportMetrics[]
}

class TjspPrecatorioSyncService {
  async sync(options: TjspPrecatorioSyncServiceOptions): Promise<TjspPrecatorioSyncServiceResult> {
    const coverageRun = await coverageRunService.start({
      tenantId: options.tenantId,
      sourceDatasetKey: 'tjsp-precatorio-communications',
      origin: options.origin ?? 'system',
      scope: {
        categories: options.categories ?? null,
        limit: options.limit ?? null,
        downloadDetails: options.downloadDetails ?? true,
        downloadDocuments: options.downloadDocuments ?? true,
        importDocuments: options.importDocuments ?? true,
      },
    })

    try {
      const syncResult = await tjspPrecatorioCommunicationsAdapter.sync({
        tenantId: options.tenantId,
        categories: options.categories ?? undefined,
        limit: options.limit ?? undefined,
        fetcher: options.fetcher,
        downloadDetails: options.downloadDetails,
        downloadDocuments: options.downloadDocuments,
      })
      const documentSourceRecords = syncResult.items.flatMap(
        (item) => item.documentSourceRecords ?? []
      )
      const imports =
        options.importDocuments === false
          ? []
          : await this.importDocumentSourceRecords(documentSourceRecords)
      const result = buildResult(syncResult, documentSourceRecords, imports)

      await coverageRunService.finish(coverageRun, 'completed', {
        discoveredCount: result.discovered,
        sourceRecordsCount: result.sourceRecordsPersisted,
        createdAssetsCount: result.assetsInserted,
        linkedAssetsCount: result.assetsInserted + result.assetsUpdated,
        enrichedAssetsCount: result.importedDocuments,
        errorCount: result.errors,
        metrics: result as unknown as JsonRecord,
      })

      return result
    } catch (error) {
      await coverageRunService.finish(coverageRun, 'failed', {
        error,
        errorCount: 1,
      })
      throw error
    }
  }

  private async importDocumentSourceRecords(sourceRecords: SourceRecord[]) {
    const imports: TjspPrecatorioDocumentImportMetrics[] = []

    for (const sourceRecord of sourceRecords) {
      const result = await tjspPrecatorioDocumentImportService.importSourceRecord(sourceRecord.id)

      imports.push({
        sourceRecordId: sourceRecord.id,
        sourceUrl: sourceRecord.sourceUrl,
        extractedRows: result.stats.extractedRows,
        importableRows: result.stats.importableRows,
        inserted: result.stats.inserted,
        updated: result.stats.updated,
        skipped: result.stats.skipped,
        errors: result.stats.errors,
      })
    }

    return imports
  }
}

function buildResult(
  syncResult: Awaited<ReturnType<typeof tjspPrecatorioCommunicationsAdapter.sync>>,
  documentSourceRecords: SourceRecord[],
  imports: TjspPrecatorioDocumentImportMetrics[]
): TjspPrecatorioSyncServiceResult {
  const communicationSourceRecords = syncResult.items.filter((item) => item.sourceRecord).length
  const totals = imports.reduce(
    (accumulator, item) => ({
      extractedRows: accumulator.extractedRows + item.extractedRows,
      importableRows: accumulator.importableRows + item.importableRows,
      assetsInserted: accumulator.assetsInserted + item.inserted,
      assetsUpdated: accumulator.assetsUpdated + item.updated,
      skippedRows: accumulator.skippedRows + item.skipped,
      errors: accumulator.errors + item.errors,
    }),
    {
      extractedRows: 0,
      importableRows: 0,
      assetsInserted: 0,
      assetsUpdated: 0,
      skippedRows: 0,
      errors: 0,
    }
  )

  return {
    discovered: syncResult.discovered,
    selected: syncResult.selected,
    sourceRecordsPersisted: syncResult.persisted,
    communicationSourceRecords,
    documentSourceRecords: documentSourceRecords.length,
    documentLinks: syncResult.documentLinks,
    importedDocuments: imports.length,
    ...totals,
    imports,
  }
}

export default new TjspPrecatorioSyncService()
