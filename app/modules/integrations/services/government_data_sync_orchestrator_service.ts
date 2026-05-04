import { DateTime } from 'luxon'
import dataJudAssetEnrichmentService from '#modules/integrations/services/datajud_asset_enrichment_service'
import dataJudCandidateMatchService from '#modules/integrations/services/datajud_candidate_match_service'
import dataJudLegalSignalClassifierService from '#modules/integrations/services/datajud_legal_signal_classifier_service'
import dataJudNationalPrecatorioSyncService from '#modules/integrations/services/datajud_national_precatorio_sync_service'
import dataJudProcessAssetLinkService from '#modules/integrations/services/datajud_process_asset_link_service'
import djenPublicationSyncService from '#modules/integrations/services/djen_publication_sync_service'
import governmentCoverageRecoveryPlanService, {
  type CoverageRecoveryPlan,
} from '#modules/integrations/services/government_coverage_recovery_plan_service'
import governmentDataSyncScheduleService from '#modules/integrations/services/government_data_sync_schedule_service'
import governmentCoverageMatrixService, {
  type CoverageLayerStatus,
  type GovernmentCoverageMatrix,
} from '#modules/integrations/services/government_coverage_matrix_service'
import publicationSignalClassifierService from '#modules/integrations/services/publication_signal_classifier_service'
import siopOpenDataSyncService from '#modules/integrations/services/siop_open_data_sync_service'
import tribunalSourceSyncService from '#modules/integrations/services/tribunal_source_sync_service'
import { governmentTimedFetch } from '#modules/integrations/services/government_timed_fetch'
import type { TjspPrecatorioCommunicationCategory } from '#modules/integrations/services/tjsp_precatorio_communications_adapter'
import type { JobRunOrigin, SourceType } from '#shared/types/model_enums'

export type GovernmentDataSyncPhaseProgressEvent = {
  phase: string
  status: 'started' | 'completed' | 'failed'
  at: string
  elapsedMs?: number | null
  errorMessage?: string | null
}

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
  tjspCategories?: TjspPrecatorioCommunicationCategory[] | null
  tjspLimit?: number | null
  tjspImportDocuments?: boolean | null
  enrichLimit?: number | null
  linkLimit?: number | null
  signalLimit?: number | null
  publicationLimit?: number | null
  matchLimit?: number | null
  candidatesPerAsset?: number | null
  source?: SourceType | null
  fetchTimeoutMs?: number | null
  phaseReporter?: (event: GovernmentDataSyncPhaseProgressEvent) => Promise<void> | void
  origin?: JobRunOrigin
  dryRun?: boolean
}

class GovernmentDataSyncOrchestratorService {
  async run(options: GovernmentDataSyncOptions) {
    const startedAt = DateTime.utc()
    const years = normalizeYears(options.years)
    const { coveragePlan, coverageRecoveryPlan } = await runPhase(
      options,
      'coveragePlanning',
      async () => {
        const coverageMatrix = await governmentCoverageMatrixService.build(options.tenantId)

        return {
          coveragePlan: buildCoveragePlan(coverageMatrix),
          coverageRecoveryPlan: governmentCoverageRecoveryPlanService.build(coverageMatrix),
        }
      }
    )
    const coverageTargetKeys = targetKeysForCoverageRecoveryPlan(coverageRecoveryPlan)
    const dataJudRecoveryAliases = courtAliasesForCoverageRecoveryPlan(
      coverageRecoveryPlan,
      'datajud'
    )
    const djenRecoveryAliases = courtAliasesForCoverageRecoveryPlan(coverageRecoveryPlan, 'djen')
    const fetcher = options.fetchTimeoutMs
      ? governmentTimedFetch({ timeoutMs: options.fetchTimeoutMs })
      : undefined

    if (options.dryRun) {
      return {
        dryRun: true,
        startedAt: startedAt.toISO(),
        years,
        phases: plannedPhases(options, years, coveragePlan, coverageRecoveryPlan),
        coveragePlan,
        coverageRecoveryPlan,
      }
    }

    const siopOpenData = await runPhase(options, 'siopOpenData', () =>
      siopOpenDataSyncService.sync({
        tenantId: options.tenantId,
        years,
        download: true,
        enqueueImports: true,
        fetcher,
        origin: options.origin ?? 'scheduler',
      })
    )
    const dataJudNationalDiscovery = await runPhase(options, 'dataJudNationalDiscovery', () =>
      dataJudNationalPrecatorioSyncService.sync({
        tenantId: options.tenantId,
        courtAliases:
          options.dataJudCourtAliases ??
          (dataJudRecoveryAliases.length > 0 ? dataJudRecoveryAliases : null),
        pageSize: options.dataJudPageSize ?? 100,
        maxPagesPerCourt: options.dataJudMaxPagesPerCourt ?? 1,
        fetcher,
        origin: options.origin ?? 'scheduler',
      })
    )
    const djenPublicationDiscovery = await runPhase(options, 'djenPublicationDiscovery', () =>
      djenPublicationSyncService.sync({
        tenantId: options.tenantId,
        courtAliases:
          options.djenCourtAliases ??
          options.dataJudCourtAliases ??
          (djenRecoveryAliases.length > 0 ? djenRecoveryAliases : null),
        searchTexts: options.djenSearchTexts,
        startDate: options.djenStartDate,
        endDate: options.djenEndDate,
        maxPagesPerCourt: options.djenMaxPagesPerCourt ?? 1,
        fetcher,
        origin: options.origin ?? 'scheduler',
      })
    )
    const tribunalSourceDiscovery = await runPhase(options, 'tribunalSourceDiscovery', () =>
      tribunalSourceSyncService.sync({
        tenantId: options.tenantId,
        targetKeys: coverageTargetKeys,
        adapterKeys: coverageTargetKeys.length > 0 ? null : defaultAdapterKeys(),
        tjspCategories: options.tjspCategories,
        tjspLimit: options.tjspLimit ?? 25,
        tjspImportDocuments: options.tjspImportDocuments ?? true,
        tjbaPageSize: 500,
        tjbaMaxPages: 25,
        tjbaImportLimit: 500,
        tjesDebtorLimit: 250,
        tjesPageSize: 500,
        tjesMaxPagesPerDebtor: 50,
        tjesImportLimit: 500,
        tjmaYears: years,
        tjmaLimit: 80,
        tjmaImportLimit: 1_000,
        genericTribunalLimit: 25,
        genericTribunalDownloadLinkedDocuments: true,
        genericTribunalImportLimit: 500,
        tjrjAnnualMapImportLimit: 10_000,
        trf1Years: years,
        trf1Limit: 25,
        trf1ImportLimit: 5_000,
        trf1ImportChunkSize: 500,
        trf2Years: years,
        trf3Years: years,
        trf3Formats: ['csv', 'xlsx'],
        trf3Limit: 24,
        trf3ImportLimit: 5_000,
        trf3ImportChunkSize: 500,
        trf5Years: years,
        trf5Limit: 10,
        trf6Years: years,
        trf6Limit: 10,
        fetcher,
        origin: options.origin ?? 'scheduler',
      })
    )
    const dataJudAssetEnrichment = await runPhase(options, 'dataJudAssetEnrichment', () =>
      dataJudAssetEnrichmentService.enrich({
        tenantId: options.tenantId,
        limit: options.enrichLimit ?? 500,
        source: options.source,
        missingOnly: true,
        dryRun: false,
        fetcher,
      })
    )
    const dataJudExactAssetLinking = await runPhase(options, 'dataJudExactAssetLinking', () =>
      dataJudProcessAssetLinkService.link({
        tenantId: options.tenantId,
        limit: options.linkLimit ?? 2_000,
        projectSignals: true,
      })
    )
    const dataJudLegalSignalClassification = await runPhase(
      options,
      'dataJudLegalSignalClassification',
      () =>
        dataJudLegalSignalClassifierService.classify({
          tenantId: options.tenantId,
          limit: options.signalLimit ?? 2_000,
          projectAssetEvents: true,
        })
    )
    const publicationSignalClassification = await runPhase(
      options,
      'publicationSignalClassification',
      () =>
        publicationSignalClassifierService.classify({
          tenantId: options.tenantId,
          limit: options.publicationLimit ?? 2_000,
          projectAssetEvents: true,
        })
    )
    const dataJudCandidateMatching = await runPhase(options, 'dataJudCandidateMatching', () =>
      dataJudCandidateMatchService.match({
        tenantId: options.tenantId,
        source: options.source,
        limit: options.matchLimit ?? 500,
        candidatesPerAsset: options.candidatesPerAsset ?? 3,
        persist: true,
        fetcher,
      })
    )

    return {
      dryRun: false,
      startedAt: startedAt.toISO(),
      finishedAt: DateTime.utc().toISO(),
      years,
      coveragePlan,
      coverageRecoveryPlan,
      phases: {
        siopOpenData,
        dataJudNationalDiscovery,
        djenPublicationDiscovery,
        tribunalSourceDiscovery,
        dataJudAssetEnrichment,
        dataJudExactAssetLinking,
        dataJudLegalSignalClassification,
        publicationSignalClassification,
        dataJudCandidateMatching: dataJudCandidateMatching.stats,
      },
    }
  }
}

async function runPhase<T>(
  options: GovernmentDataSyncOptions,
  phase: string,
  callback: () => Promise<T>
) {
  const startedAt = DateTime.utc()
  await reportPhase(options, {
    phase,
    status: 'started',
    at: startedAt.toISO(),
  })

  try {
    const result = await callback()
    await reportPhase(options, {
      phase,
      status: 'completed',
      at: DateTime.utc().toISO(),
      elapsedMs: DateTime.utc().diff(startedAt, 'milliseconds').milliseconds,
    })

    return result
  } catch (error) {
    await reportPhase(options, {
      phase,
      status: 'failed',
      at: DateTime.utc().toISO(),
      elapsedMs: DateTime.utc().diff(startedAt, 'milliseconds').milliseconds,
      errorMessage: error instanceof Error ? error.message : String(error),
    })

    throw error
  }
}

async function reportPhase(
  options: GovernmentDataSyncOptions,
  event: GovernmentDataSyncPhaseProgressEvent
) {
  await options.phaseReporter?.(event)
}

function normalizeYears(years?: number[] | null) {
  if (years?.length) {
    return [...new Set(years.map((year) => Math.trunc(year)).filter((year) => year >= 2008))]
  }

  return governmentDataSyncScheduleService.siopBackfillYears()
}

function plannedPhases(
  options: GovernmentDataSyncOptions,
  years: number[],
  coveragePlan?: GovernmentCoveragePlan,
  coverageRecoveryPlan?: CoverageRecoveryPlan
) {
  const plannedTargetKeys = coverageRecoveryPlan
    ? targetKeysForCoverageRecoveryPlan(coverageRecoveryPlan)
    : coveragePlan
      ? targetKeysForCoveragePlan(coveragePlan)
      : []
  const plannedDataJudAliases = coverageRecoveryPlan
    ? courtAliasesForCoverageRecoveryPlan(coverageRecoveryPlan, 'datajud')
    : []
  const plannedDjenAliases = coverageRecoveryPlan
    ? courtAliasesForCoverageRecoveryPlan(coverageRecoveryPlan, 'djen')
    : []

  return {
    siopOpenData: {
      years,
      download: true,
      enqueueImports: true,
      fetchTimeoutMs: options.fetchTimeoutMs ?? null,
    },
    dataJudNationalDiscovery: {
      courtAliases:
        options.dataJudCourtAliases ??
        (plannedDataJudAliases.length > 0 ? plannedDataJudAliases : 'all'),
      pageSize: options.dataJudPageSize ?? 100,
      maxPagesPerCourt: options.dataJudMaxPagesPerCourt ?? 1,
      fetchTimeoutMs: options.fetchTimeoutMs ?? null,
    },
    djenPublicationDiscovery: {
      courtAliases:
        options.djenCourtAliases ??
        options.dataJudCourtAliases ??
        (plannedDjenAliases.length > 0 ? plannedDjenAliases : 'all'),
      searchTexts: options.djenSearchTexts ?? ['precatório', 'RPV'],
      startDate: options.djenStartDate ?? null,
      endDate: options.djenEndDate ?? null,
      maxPagesPerCourt: options.djenMaxPagesPerCourt ?? 1,
      fetchTimeoutMs: options.fetchTimeoutMs ?? null,
    },
    tribunalSourceDiscovery: {
      targetKeys: plannedTargetKeys.length > 0 ? plannedTargetKeys : 'coverage_plan',
      adapterKeys: plannedTargetKeys.length > 0 ? null : defaultAdapterKeys(),
      recoveryPriority:
        coverageRecoveryPlan?.targets.slice(0, 10).map((target) => ({
          targetKey: target.targetKey,
          layer: target.layer,
          priority: target.priority,
          priorityScore: target.priorityScore,
          reasons: target.reasons,
        })) ?? null,
      tjspCategories: options.tjspCategories ?? ['state_entities', 'municipal_entities'],
      tjspLimit: options.tjspLimit ?? 25,
      tjspImportDocuments: options.tjspImportDocuments ?? true,
      tjbaPageSize: 500,
      tjbaMaxPages: 25,
      tjbaImportLimit: 500,
      tjesDebtorLimit: 250,
      tjesPageSize: 500,
      tjesMaxPagesPerDebtor: 50,
      tjesImportLimit: 500,
      tjmaYears: years,
      tjmaLimit: 80,
      tjmaImportLimit: 1_000,
      genericTribunalLimit: 25,
      genericTribunalDownloadLinkedDocuments: true,
      genericTribunalImportLimit: 500,
      tjrjAnnualMapImportLimit: 10_000,
      trf1Years: years,
      trf1Limit: 25,
      trf1ImportLimit: 5_000,
      trf1ImportChunkSize: 500,
      trf2Years: years,
      trf3Years: years,
      trf3Formats: ['csv', 'xlsx'],
      trf3Limit: 24,
      trf3ImportLimit: 5_000,
      trf3ImportChunkSize: 500,
      trf5Years: years,
      trf5Limit: 10,
      trf6Years: years,
      trf6Limit: 10,
      fetchTimeoutMs: options.fetchTimeoutMs ?? null,
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

function buildCoveragePlan(matrix: GovernmentCoverageMatrix) {
  return {
    generatedAt: matrix.generatedAt,
    summary: matrix.summary,
    primarySyncTargets: matrix.states
      .filter((state) => shouldSyncPrimary(state.primary.status))
      .map((state) => ({
        stateCode: state.stateCode,
        courtAlias: state.courtAlias,
        targetKey: state.primary.targetKey,
        adapterKey: state.primary.adapterKey,
        status: state.primary.status,
        lastSuccessAt: state.primary.lastSuccessAt,
        tenantSourceRecordsCount: state.primary.tenantSourceRecordsCount,
        quality: state.primary.quality,
        nextActions: state.nextActions,
      })),
    enrichmentTargets: matrix.states
      .filter((state) => state.datajud.status !== 'missing' || state.djen.status !== 'missing')
      .map((state) => ({
        stateCode: state.stateCode,
        courtAlias: state.courtAlias,
        datajudStatus: state.datajud.status,
        djenStatus: state.djen.status,
        readyForOperationalScoring: state.intelligence.readyForOperationalScoring,
      })),
    adapterBacklog: matrix.gaps
      .filter((gap) =>
        ['primary_source_missing', 'primary_source_mapped_without_adapter'].includes(gap.code)
      )
      .map((gap) => ({
        level: gap.level,
        stateCode: gap.stateCode,
        courtAlias: gap.courtAlias,
        severity: gap.severity,
        code: gap.code,
        recommendedAction: gap.recommendedAction,
      })),
    federalPrimaryTargets: matrix.federal.map((item) => ({
      courtAlias: item.courtAlias,
      status: item.primary.status,
      targetKey: item.primary.targetKey,
      adapterKey: item.primary.adapterKey,
      lastSuccessAt: item.primary.lastSuccessAt,
      quality: item.primary.quality,
      nextActions: item.nextActions,
    })),
  }
}

type GovernmentCoveragePlan = ReturnType<typeof buildCoveragePlan>

function targetKeysForCoveragePlan(plan: GovernmentCoveragePlan) {
  return [
    ...plan.primarySyncTargets.map((target) => target.targetKey),
    ...plan.federalPrimaryTargets
      .filter((target) => shouldSyncPrimary(target.status))
      .map((target) => target.targetKey),
  ].filter((targetKey): targetKey is string => typeof targetKey === 'string' && targetKey !== '')
}

function targetKeysForCoverageRecoveryPlan(plan: CoverageRecoveryPlan) {
  return plan.executableTargetKeysByLayer.primary
}

function courtAliasesForCoverageRecoveryPlan(
  plan: CoverageRecoveryPlan,
  layer: 'datajud' | 'djen'
) {
  return [
    ...new Set(
      plan.targets.filter((target) => target.layer === layer).map((target) => target.courtAlias)
    ),
  ]
}

function defaultAdapterKeys() {
  return [
    'tjsp_precatorio_sync',
    'tjba_precatorio_api_sync',
    'tjes_lup_precatorio_api_sync',
    'tjma_precatorio_sync',
    'generic_tribunal_public_source_sync',
    'trf1_precatorio_sync',
    'trf2_precatorio_sync',
    'trf3_precatorio_sync',
    'trf4_precatorio_sync',
    'trf5_precatorio_sync',
    'trf6_precatorio_sync',
  ]
}

function shouldSyncPrimary(status: CoverageLayerStatus) {
  return status === 'configured' || status === 'validated'
}

export default new GovernmentDataSyncOrchestratorService()
