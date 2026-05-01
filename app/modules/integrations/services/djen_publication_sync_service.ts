import { DateTime } from 'luxon'
import djenPublicationAdapter from '#modules/integrations/services/djen_publication_adapter'
import coverageRunService from '#modules/integrations/services/coverage_run_service'
import governmentSourceCatalog from '#modules/integrations/services/government_source_catalog'
import type { JobRunOrigin, JsonRecord } from '#shared/types/model_enums'

export type DjenPublicationSyncServiceOptions = {
  tenantId: string
  courtAliases?: string[] | null
  searchTexts?: string[] | null
  startDate?: string | null
  endDate?: string | null
  maxPagesPerCourt?: number | null
  itemsPerPage?: 5 | 100 | null
  fetcher?: typeof fetch
  origin?: JobRunOrigin
}

export type DjenPublicationCourtMetrics = {
  courtAlias: string
  searchText: string
  requestedPages: number
  count: number
  fetched: number
  sourceRecordsCreated: number
  sourceRecordsReused: number
  processesCreated: number
  processesUpdated: number
  publicationsCreated: number
  publicationsUpdated: number
  linkedAssets: number
  matchedSignals: number
  publicationEventsUpserted: number
  assetEventsUpserted: number
  assetScoresRefreshed: number
  errors: number
  errorMessages: string[]
}

export type DjenPublicationSyncServiceResult = {
  requestedCourts: number
  startDate: string
  endDate: string
  maxPagesPerCourt: number
  searchTexts: string[]
  courts: DjenPublicationCourtMetrics[]
  totals: Omit<DjenPublicationCourtMetrics, 'courtAlias' | 'searchText' | 'errorMessages'>
}

class DjenPublicationSyncService {
  async sync(
    options: DjenPublicationSyncServiceOptions
  ): Promise<DjenPublicationSyncServiceResult> {
    const courtAliases = normalizeCourtAliases(options.courtAliases)
    const searchTexts = normalizeSearchTexts(options.searchTexts)
    const startDate = normalizeDate(options.startDate, DateTime.utc().minus({ days: 1 }))
    const endDate = normalizeDate(options.endDate, DateTime.utc())
    const maxPagesPerCourt = normalizeMaxPages(options.maxPagesPerCourt)
    const coverageRun = await coverageRunService.start({
      tenantId: options.tenantId,
      sourceDatasetKey: 'djen-public-communications',
      origin: options.origin ?? 'system',
      scope: {
        courtAliases,
        searchTexts,
        startDate,
        endDate,
        maxPagesPerCourt,
        itemsPerPage: options.itemsPerPage ?? 100,
      },
    })

    try {
      const courts: DjenPublicationCourtMetrics[] = []
      for (const courtAlias of courtAliases) {
        for (const searchText of searchTexts) {
          courts.push(
            await this.syncCourt({
              ...options,
              courtAlias,
              searchText,
              startDate,
              endDate,
              maxPagesPerCourt,
            })
          )
        }
      }

      const result = {
        requestedCourts: courtAliases.length,
        startDate,
        endDate,
        maxPagesPerCourt,
        searchTexts,
        courts,
        totals: sumCourtMetrics(courts),
      }

      await coverageRunService.finish(coverageRun, 'completed', {
        discoveredCount: result.totals.count,
        sourceRecordsCount: result.totals.sourceRecordsCreated + result.totals.sourceRecordsReused,
        createdAssetsCount: result.totals.processesCreated,
        linkedAssetsCount: result.totals.linkedAssets,
        enrichedAssetsCount: result.totals.publicationsCreated + result.totals.publicationsUpdated,
        errorCount: result.totals.errors,
        metrics: result as unknown as JsonRecord,
      })

      return result
    } catch (error) {
      await coverageRunService.finish(coverageRun, 'failed', {
        error,
        errorCount: 1,
        metrics: {
          courtAliases,
          searchTexts,
          startDate,
          endDate,
          maxPagesPerCourt,
        },
      })
      throw error
    }
  }

  private async syncCourt(
    options: DjenPublicationSyncServiceOptions & {
      courtAlias: string
      searchText: string
      startDate: string
      endDate: string
      maxPagesPerCourt: number
    }
  ) {
    const metrics = emptyCourtMetrics(options.courtAlias, options.searchText)

    try {
      const result = await djenPublicationAdapter.sync({
        tenantId: options.tenantId,
        siglaTribunal: options.courtAlias,
        texto: options.searchText,
        dataDisponibilizacaoInicio: options.startDate,
        dataDisponibilizacaoFim: options.endDate,
        meio: 'D',
        itensPorPagina: options.itemsPerPage ?? 100,
        maxPages: options.maxPagesPerCourt,
        fetcher: options.fetcher,
        classifySignals: true,
      })

      metrics.requestedPages = result.requestedPages
      metrics.count = result.count
      metrics.fetched = result.fetched
      metrics.sourceRecordsCreated = result.sourceRecordsCreated
      metrics.sourceRecordsReused = result.sourceRecordsReused
      metrics.processesCreated = result.processesCreated
      metrics.processesUpdated = result.processesUpdated
      metrics.publicationsCreated = result.publicationsCreated
      metrics.publicationsUpdated = result.publicationsUpdated
      metrics.linkedAssets = result.linkedAssets
      metrics.matchedSignals = result.publicationSignals.matchedSignals
      metrics.publicationEventsUpserted = result.publicationSignals.publicationEventsUpserted
      metrics.assetEventsUpserted = result.publicationSignals.assetEventsUpserted
      metrics.assetScoresRefreshed = result.publicationSignals.assetScoresRefreshed
    } catch (error) {
      metrics.errors += 1
      metrics.errorMessages.push(error instanceof Error ? error.message : String(error))
    }

    return metrics
  }
}

function normalizeCourtAliases(value?: string[] | null) {
  const aliases = value?.length ? value : governmentSourceCatalog.dataJudCourtAliases()

  return [...new Set(aliases.map((alias) => alias.trim().toUpperCase()).filter(Boolean))]
}

function normalizeSearchTexts(value?: string[] | null) {
  const texts = value?.length ? value : ['precatório', 'RPV']

  return [...new Set(texts.map((text) => text.trim()).filter(Boolean))]
}

function normalizeDate(value: string | null | undefined, fallback: DateTime) {
  if (!value) {
    return fallback.toISODate()!
  }

  const date = DateTime.fromISO(value, { zone: 'utc' })
  return date.isValid ? date.toISODate()! : fallback.toISODate()!
}

function normalizeMaxPages(value?: number | null) {
  if (!value || value < 1) {
    return 1
  }

  return Math.min(Math.floor(value), 100)
}

function emptyCourtMetrics(courtAlias: string, searchText: string): DjenPublicationCourtMetrics {
  return {
    courtAlias,
    searchText,
    requestedPages: 0,
    count: 0,
    fetched: 0,
    sourceRecordsCreated: 0,
    sourceRecordsReused: 0,
    processesCreated: 0,
    processesUpdated: 0,
    publicationsCreated: 0,
    publicationsUpdated: 0,
    linkedAssets: 0,
    matchedSignals: 0,
    publicationEventsUpserted: 0,
    assetEventsUpserted: 0,
    assetScoresRefreshed: 0,
    errors: 0,
    errorMessages: [],
  }
}

function sumCourtMetrics(courts: DjenPublicationCourtMetrics[]) {
  return courts.reduce(
    (totals, court) => ({
      requestedPages: totals.requestedPages + court.requestedPages,
      count: totals.count + court.count,
      fetched: totals.fetched + court.fetched,
      sourceRecordsCreated: totals.sourceRecordsCreated + court.sourceRecordsCreated,
      sourceRecordsReused: totals.sourceRecordsReused + court.sourceRecordsReused,
      processesCreated: totals.processesCreated + court.processesCreated,
      processesUpdated: totals.processesUpdated + court.processesUpdated,
      publicationsCreated: totals.publicationsCreated + court.publicationsCreated,
      publicationsUpdated: totals.publicationsUpdated + court.publicationsUpdated,
      linkedAssets: totals.linkedAssets + court.linkedAssets,
      matchedSignals: totals.matchedSignals + court.matchedSignals,
      publicationEventsUpserted: totals.publicationEventsUpserted + court.publicationEventsUpserted,
      assetEventsUpserted: totals.assetEventsUpserted + court.assetEventsUpserted,
      assetScoresRefreshed: totals.assetScoresRefreshed + court.assetScoresRefreshed,
      errors: totals.errors + court.errors,
    }),
    {
      requestedPages: 0,
      count: 0,
      fetched: 0,
      sourceRecordsCreated: 0,
      sourceRecordsReused: 0,
      processesCreated: 0,
      processesUpdated: 0,
      publicationsCreated: 0,
      publicationsUpdated: 0,
      linkedAssets: 0,
      matchedSignals: 0,
      publicationEventsUpserted: 0,
      assetEventsUpserted: 0,
      assetScoresRefreshed: 0,
      errors: 0,
    }
  )
}

export default new DjenPublicationSyncService()
