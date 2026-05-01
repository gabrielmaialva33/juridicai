import { DateTime } from 'luxon'
import dataJudAssetEnrichmentService from '#modules/integrations/services/datajud_asset_enrichment_service'
import dataJudCandidateMatchService from '#modules/integrations/services/datajud_candidate_match_service'
import dataJudLegalSignalClassifierService from '#modules/integrations/services/datajud_legal_signal_classifier_service'
import dataJudNationalPrecatorioSyncService from '#modules/integrations/services/datajud_national_precatorio_sync_service'
import dataJudProcessAssetLinkService from '#modules/integrations/services/datajud_process_asset_link_service'
import djenPublicationSyncService from '#modules/integrations/services/djen_publication_sync_service'
import governmentDataSyncScheduleService from '#modules/integrations/services/government_data_sync_schedule_service'
import publicationSignalClassifierService from '#modules/integrations/services/publication_signal_classifier_service'
import siopOpenDataSyncService from '#modules/integrations/services/siop_open_data_sync_service'
import type { JobRunOrigin, SourceType } from '#shared/types/model_enums'

export type GovernmentDataSyncOptions = {
  tenantId: string
  years?: number[] | null
  dataJudCourtAliases?: string[] | null
  dataJudPageSize?: number | null
  dataJudMaxPagesPerCourt?: number | null
  djenCourtAliases?: string[] | null
  djenSearchTexts?: string[] | null
  djenStartDate?: string | null
  djenEndDate?: string | null
  djenMaxPagesPerCourt?: number | null
  enrichLimit?: number | null
  linkLimit?: number | null
  signalLimit?: number | null
  publicationLimit?: number | null
  matchLimit?: number | null
  candidatesPerAsset?: number | null
  source?: SourceType | null
  origin?: JobRunOrigin
  dryRun?: boolean
}

class GovernmentDataSyncOrchestratorService {
  async run(options: GovernmentDataSyncOptions) {
    const startedAt = DateTime.utc()
    const years = normalizeYears(options.years)

    if (options.dryRun) {
      return {
        dryRun: true,
        startedAt: startedAt.toISO(),
        years,
        phases: plannedPhases(options, years),
      }
    }

    const siopOpenData = await siopOpenDataSyncService.sync({
      tenantId: options.tenantId,
      years,
      download: true,
      enqueueImports: true,
      origin: options.origin ?? 'scheduler',
    })
    const dataJudNationalDiscovery = await dataJudNationalPrecatorioSyncService.sync({
      tenantId: options.tenantId,
      courtAliases: options.dataJudCourtAliases,
      pageSize: options.dataJudPageSize ?? 100,
      maxPagesPerCourt: options.dataJudMaxPagesPerCourt ?? 1,
      origin: options.origin ?? 'scheduler',
    })
    const djenPublicationDiscovery = await djenPublicationSyncService.sync({
      tenantId: options.tenantId,
      courtAliases: options.djenCourtAliases ?? options.dataJudCourtAliases,
      searchTexts: options.djenSearchTexts,
      startDate: options.djenStartDate,
      endDate: options.djenEndDate,
      maxPagesPerCourt: options.djenMaxPagesPerCourt ?? 1,
      origin: options.origin ?? 'scheduler',
    })
    const dataJudAssetEnrichment = await dataJudAssetEnrichmentService.enrich({
      tenantId: options.tenantId,
      limit: options.enrichLimit ?? 500,
      source: options.source,
      missingOnly: true,
      dryRun: false,
    })
    const dataJudExactAssetLinking = await dataJudProcessAssetLinkService.link({
      tenantId: options.tenantId,
      limit: options.linkLimit ?? 2_000,
      projectSignals: true,
    })
    const dataJudLegalSignalClassification = await dataJudLegalSignalClassifierService.classify({
      tenantId: options.tenantId,
      limit: options.signalLimit ?? 2_000,
      projectAssetEvents: true,
    })
    const publicationSignalClassification = await publicationSignalClassifierService.classify({
      tenantId: options.tenantId,
      limit: options.publicationLimit ?? 2_000,
      projectAssetEvents: true,
    })
    const dataJudCandidateMatching = await dataJudCandidateMatchService.match({
      tenantId: options.tenantId,
      source: options.source,
      limit: options.matchLimit ?? 500,
      candidatesPerAsset: options.candidatesPerAsset ?? 3,
      persist: true,
    })

    return {
      dryRun: false,
      startedAt: startedAt.toISO(),
      finishedAt: DateTime.utc().toISO(),
      years,
      phases: {
        siopOpenData,
        dataJudNationalDiscovery,
        djenPublicationDiscovery,
        dataJudAssetEnrichment,
        dataJudExactAssetLinking,
        dataJudLegalSignalClassification,
        publicationSignalClassification,
        dataJudCandidateMatching: dataJudCandidateMatching.stats,
      },
    }
  }
}

function normalizeYears(years?: number[] | null) {
  if (years?.length) {
    return [...new Set(years.map((year) => Math.trunc(year)).filter((year) => year >= 2008))]
  }

  return governmentDataSyncScheduleService.siopBackfillYears()
}

function plannedPhases(options: GovernmentDataSyncOptions, years: number[]) {
  return {
    siopOpenData: {
      years,
      download: true,
      enqueueImports: true,
    },
    dataJudNationalDiscovery: {
      courtAliases: options.dataJudCourtAliases ?? 'all',
      pageSize: options.dataJudPageSize ?? 100,
      maxPagesPerCourt: options.dataJudMaxPagesPerCourt ?? 1,
    },
    djenPublicationDiscovery: {
      courtAliases: options.djenCourtAliases ?? options.dataJudCourtAliases ?? 'all',
      searchTexts: options.djenSearchTexts ?? ['precatório', 'RPV'],
      startDate: options.djenStartDate ?? null,
      endDate: options.djenEndDate ?? null,
      maxPagesPerCourt: options.djenMaxPagesPerCourt ?? 1,
    },
    dataJudAssetEnrichment: {
      limit: options.enrichLimit ?? 500,
      source: options.source ?? null,
      missingOnly: true,
    },
    dataJudExactAssetLinking: {
      limit: options.linkLimit ?? 2_000,
      projectSignals: true,
    },
    dataJudLegalSignalClassification: {
      limit: options.signalLimit ?? 2_000,
      projectAssetEvents: true,
    },
    publicationSignalClassification: {
      limit: options.publicationLimit ?? 2_000,
      projectAssetEvents: true,
    },
    dataJudCandidateMatching: {
      limit: options.matchLimit ?? 500,
      candidatesPerAsset: options.candidatesPerAsset ?? 3,
      persist: true,
    },
  }
}

export default new GovernmentDataSyncOrchestratorService()
