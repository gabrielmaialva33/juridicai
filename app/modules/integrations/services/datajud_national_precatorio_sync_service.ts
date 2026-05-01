import dataJudPublicApiAdapter from '#modules/integrations/services/datajud_public_api_adapter'
import coverageRunService from '#modules/integrations/services/coverage_run_service'
import governmentSourceCatalog from '#modules/integrations/services/government_source_catalog'
import type { JobRunOrigin, JsonRecord } from '#shared/types/model_enums'

export const DATAJUD_PRECATORIO_CLASS_CODES = [1265, 1266] as const

export type DataJudNationalPrecatorioSyncOptions = {
  tenantId: string
  courtAliases?: string[] | null
  pageSize?: number | null
  maxPagesPerCourt?: number | null
  fetcher?: typeof fetch
  apiKey?: string
  origin?: JobRunOrigin
}

export type DataJudNationalPrecatorioCourtMetrics = {
  courtAlias: string
  pages: number
  hits: number
  persisted: number
  created: number
  updated: number
  subjects: number
  movements: number
  movementComplements: number
  errors: number
  errorMessages: string[]
}

export type DataJudNationalPrecatorioSyncResult = {
  requestedCourts: number
  pageSize: number
  maxPagesPerCourt: number
  classCodes: number[]
  courts: DataJudNationalPrecatorioCourtMetrics[]
  totals: {
    pages: number
    hits: number
    persisted: number
    created: number
    updated: number
    subjects: number
    movements: number
    movementComplements: number
    errors: number
  }
}

class DataJudNationalPrecatorioSyncService {
  async sync(
    options: DataJudNationalPrecatorioSyncOptions
  ): Promise<DataJudNationalPrecatorioSyncResult> {
    const pageSize = normalizePageSize(options.pageSize)
    const maxPagesPerCourt = normalizeMaxPages(options.maxPagesPerCourt)
    const courtAliases = normalizeCourtAliases(options.courtAliases)
    const courts: DataJudNationalPrecatorioCourtMetrics[] = []
    const coverageRun = await coverageRunService.start({
      tenantId: options.tenantId,
      sourceDatasetKey: 'datajud-public-api',
      origin: options.origin ?? 'system',
      scope: {
        courtAliases,
        pageSize,
        maxPagesPerCourt,
        classCodes: [...DATAJUD_PRECATORIO_CLASS_CODES],
      },
    })

    try {
      for (const courtAlias of courtAliases) {
        courts.push(await this.syncCourt({ ...options, courtAlias, pageSize, maxPagesPerCourt }))
      }

      const result = {
        requestedCourts: courtAliases.length,
        pageSize,
        maxPagesPerCourt,
        classCodes: [...DATAJUD_PRECATORIO_CLASS_CODES],
        courts,
        totals: courts.reduce(
          (totals, court) => ({
            pages: totals.pages + court.pages,
            hits: totals.hits + court.hits,
            persisted: totals.persisted + court.persisted,
            created: totals.created + court.created,
            updated: totals.updated + court.updated,
            subjects: totals.subjects + court.subjects,
            movements: totals.movements + court.movements,
            movementComplements: totals.movementComplements + court.movementComplements,
            errors: totals.errors + court.errors,
          }),
          {
            pages: 0,
            hits: 0,
            persisted: 0,
            created: 0,
            updated: 0,
            subjects: 0,
            movements: 0,
            movementComplements: 0,
            errors: 0,
          }
        ),
      }

      await coverageRunService.finish(coverageRun, 'completed', {
        discoveredCount: result.totals.hits,
        sourceRecordsCount: result.totals.pages,
        createdAssetsCount: result.totals.created,
        linkedAssetsCount: result.totals.persisted,
        enrichedAssetsCount: result.totals.updated,
        errorCount: result.totals.errors,
        metrics: result as unknown as JsonRecord,
      })

      return result
    } catch (error) {
      await coverageRunService.finish(coverageRun, 'failed', {
        error,
        errorCount: 1,
        metrics: {
          requestedCourts: courtAliases.length,
          pageSize,
          maxPagesPerCourt,
          courtAliases,
        },
      })
      throw error
    }
  }

  private async syncCourt(
    options: DataJudNationalPrecatorioSyncOptions & {
      courtAlias: string
      pageSize: number
      maxPagesPerCourt: number
    }
  ) {
    const metrics: DataJudNationalPrecatorioCourtMetrics = {
      courtAlias: options.courtAlias,
      pages: 0,
      hits: 0,
      persisted: 0,
      created: 0,
      updated: 0,
      subjects: 0,
      movements: 0,
      movementComplements: 0,
      errors: 0,
      errorMessages: [],
    }
    const baseQuery = buildPrecatorioQuery()

    try {
      const pages = dataJudPublicApiAdapter.searchPages({
        courtAlias: options.courtAlias,
        body: baseQuery,
        pageSize: options.pageSize,
        fetcher: options.fetcher,
        apiKey: options.apiKey,
      })

      for await (const page of pages) {
        metrics.pages += 1
        metrics.hits += page.hits.hits.length

        for (const hit of page.hits.hits) {
          const persisted = await dataJudPublicApiAdapter.persistHit({
            tenantId: options.tenantId,
            courtAlias: options.courtAlias,
            query: baseQuery,
            response: page,
            hit,
          })

          if (!persisted) {
            continue
          }

          metrics.persisted += 1
          metrics.subjects += persisted.subjectsUpserted
          metrics.movements += persisted.movementsUpserted
          metrics.movementComplements += persisted.movementComplementsUpserted
          if (persisted.created) {
            metrics.created += 1
          } else {
            metrics.updated += 1
          }
        }

        if (metrics.pages >= options.maxPagesPerCourt) {
          break
        }
      }
    } catch (error) {
      metrics.errors += 1
      metrics.errorMessages.push(error instanceof Error ? error.message : String(error))
    }

    return metrics
  }
}

function buildPrecatorioQuery(): JsonRecord {
  return {
    query: {
      bool: {
        should: DATAJUD_PRECATORIO_CLASS_CODES.map((code) => ({
          match: { 'classe.codigo': code },
        })),
        minimum_should_match: 1,
      },
    },
  }
}

function normalizeCourtAliases(value?: string[] | null) {
  const aliases = value?.length ? value : governmentSourceCatalog.dataJudCourtAliases()

  return [...new Set(aliases.map((alias) => alias.trim().toLowerCase()).filter(Boolean))]
}

function normalizePageSize(value?: number | null) {
  if (!value || value < 1) {
    return 100
  }

  return Math.min(Math.floor(value), 1_000)
}

function normalizeMaxPages(value?: number | null) {
  if (!value || value < 1) {
    return 1
  }

  return Math.min(Math.floor(value), 100)
}

export default new DataJudNationalPrecatorioSyncService()
