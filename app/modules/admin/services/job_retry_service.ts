import { EXPORT_PRECATORIOS_QUEUE } from '#modules/exports/jobs/export_precatorios_handler'
import { DATAJUD_ENRICH_ASSETS_QUEUE } from '#modules/integrations/jobs/datajud_enrich_assets_handler'
import { DATAJUD_LEGAL_SIGNAL_CLASSIFIER_QUEUE } from '#modules/integrations/jobs/datajud_legal_signal_classifier_handler'
import { DATAJUD_MATCH_CANDIDATES_QUEUE } from '#modules/integrations/jobs/datajud_match_candidates_handler'
import { DATAJUD_NATIONAL_PRECATORIO_SYNC_QUEUE } from '#modules/integrations/jobs/datajud_national_precatorio_sync_handler'
import { DATAJUD_PROCESS_ASSET_LINK_QUEUE } from '#modules/integrations/jobs/datajud_process_asset_link_handler'
import { GOVERNMENT_DATA_SYNC_ORCHESTRATOR_QUEUE } from '#modules/integrations/jobs/government_data_sync_orchestrator_handler'
import { ASSET_INTELLIGENCE_RECONCILE_QUEUE } from '#modules/operations/jobs/asset_intelligence_reconcile_handler'
import { SIOP_IMPORT_QUEUE } from '#modules/siop/jobs/siop_import_handler'
import { SIOP_OPEN_DATA_SYNC_QUEUE } from '#modules/integrations/jobs/siop_open_data_sync_handler'
import { TJSP_PRECATORIO_SYNC_QUEUE } from '#modules/integrations/jobs/tjsp_precatorio_sync_handler'
import { TRF6_MANUAL_EXPORT_IMPORT_QUEUE } from '#modules/integrations/jobs/trf6_manual_export_import_handler'
import { POST_IMPORT_ENRICHMENT_QUEUE } from '#modules/integrations/jobs/post_import_enrichment_handler'
import { TRIBUNAL_SOURCE_SYNC_QUEUE } from '#modules/integrations/jobs/tribunal_source_sync_handler'
import queueService from '#shared/services/queue_service'
import type RadarJobRun from '#modules/admin/models/radar_job_run'
import type { JobRunStatus, JsonRecord } from '#shared/types/model_enums'

const RETRIABLE_STATUSES = new Set<JobRunStatus>(['failed', 'skipped', 'cancelled'])

class JobRetryError extends Error {
  constructor(
    public code: 'not_retriable' | 'unsupported_job' | 'missing_metadata',
    message: string
  ) {
    super(message)
  }
}

class JobRetryService {
  async retry(run: RadarJobRun, requestId?: string | null) {
    if (!RETRIABLE_STATUSES.has(run.status)) {
      throw new JobRetryError('not_retriable', `Job run status '${run.status}' cannot be retried.`)
    }

    if (!run.tenantId) {
      throw new JobRetryError(
        'unsupported_job',
        'Global job runs are not retried from tenant admin.'
      )
    }

    const retry = this.buildRetry(run, requestId)
    const job = await queueService.add(retry.queueName, retry.jobName, retry.payload, {
      jobId: `${retry.jobName}-retry-${run.id}-${Date.now()}`,
    })

    return {
      queueName: retry.queueName,
      jobName: retry.jobName,
      bullmqJobId: job.id ? String(job.id) : null,
    }
  }

  private buildRetry(run: RadarJobRun, requestId?: string | null) {
    switch (run.jobName) {
      case 'siop-import': {
        const importId = stringMetadata(run.metadata, 'importId')
        if (!importId) {
          throw new JobRetryError(
            'missing_metadata',
            'SIOP import retry requires importId metadata.'
          )
        }

        return {
          queueName: SIOP_IMPORT_QUEUE,
          jobName: 'siop-import',
          payload: {
            tenantId: run.tenantId!,
            importId,
            requestId: requestId ?? stringMetadata(run.metadata, 'requestId'),
            origin: 'manual_retry' as const,
            enqueuePostImportEnrichment: true,
          },
        }
      }

      case 'exports-precatorios': {
        const exportJobId = stringMetadata(run.metadata, 'exportJobId')
        if (!exportJobId) {
          throw new JobRetryError(
            'missing_metadata',
            'Precatorio export retry requires exportJobId metadata.'
          )
        }

        return {
          queueName: EXPORT_PRECATORIOS_QUEUE,
          jobName: 'exports-precatorios',
          payload: {
            tenantId: run.tenantId!,
            exportJobId,
            requestId: requestId ?? stringMetadata(run.metadata, 'requestId'),
            origin: 'manual_retry' as const,
          },
        }
      }

      case 'datajud-enrich-assets': {
        return {
          queueName: DATAJUD_ENRICH_ASSETS_QUEUE,
          jobName: 'datajud-enrich-assets',
          payload: {
            tenantId: run.tenantId!,
            requestId: requestId ?? stringMetadata(run.metadata, 'requestId'),
            assetIds: stringArrayMetadata(run.metadata, 'assetIds'),
            sourceRecordId: stringMetadata(run.metadata, 'sourceRecordId'),
            limit: numberMetadata(run.metadata, 'limit'),
            source: stringMetadata(run.metadata, 'source'),
            missingOnly: booleanMetadata(run.metadata, 'missingOnly') ?? true,
            courtAliases: stringArrayMetadata(run.metadata, 'courtAliases'),
            dryRun: booleanMetadata(run.metadata, 'dryRun') ?? false,
            origin: 'manual_retry' as const,
          },
        }
      }

      case 'datajud-national-precatorio-sync': {
        return {
          queueName: DATAJUD_NATIONAL_PRECATORIO_SYNC_QUEUE,
          jobName: 'datajud-national-precatorio-sync',
          payload: {
            tenantId: run.tenantId!,
            requestId: requestId ?? stringMetadata(run.metadata, 'requestId'),
            courtAliases: stringArrayMetadata(run.metadata, 'courtAliases'),
            pageSize: numberMetadata(run.metadata, 'pageSize'),
            maxPagesPerCourt: numberMetadata(run.metadata, 'maxPagesPerCourt'),
            origin: 'manual_retry' as const,
          },
        }
      }

      case 'datajud-match-candidates': {
        return {
          queueName: DATAJUD_MATCH_CANDIDATES_QUEUE,
          jobName: 'datajud-match-candidates',
          payload: {
            tenantId: run.tenantId!,
            requestId: requestId ?? stringMetadata(run.metadata, 'requestId'),
            assetIds: stringArrayMetadata(run.metadata, 'assetIds'),
            sourceRecordId: stringMetadata(run.metadata, 'sourceRecordId'),
            source: stringMetadata(run.metadata, 'source'),
            limit: numberMetadata(run.metadata, 'limit'),
            candidatesPerAsset: numberMetadata(run.metadata, 'candidatesPerAsset'),
            persist: booleanMetadata(run.metadata, 'persist') ?? true,
            origin: 'manual_retry' as const,
          },
        }
      }

      case 'datajud-legal-signal-classifier': {
        return {
          queueName: DATAJUD_LEGAL_SIGNAL_CLASSIFIER_QUEUE,
          jobName: 'datajud-legal-signal-classifier',
          payload: {
            tenantId: run.tenantId!,
            requestId: requestId ?? stringMetadata(run.metadata, 'requestId'),
            limit: numberMetadata(run.metadata, 'limit'),
            processId: stringMetadata(run.metadata, 'processId'),
            projectAssetEvents: booleanMetadata(run.metadata, 'projectAssetEvents') ?? true,
            origin: 'manual_retry' as const,
          },
        }
      }

      case 'datajud-process-asset-link': {
        return {
          queueName: DATAJUD_PROCESS_ASSET_LINK_QUEUE,
          jobName: 'datajud-process-asset-link',
          payload: {
            tenantId: run.tenantId!,
            requestId: requestId ?? stringMetadata(run.metadata, 'requestId'),
            limit: numberMetadata(run.metadata, 'limit'),
            projectSignals: booleanMetadata(run.metadata, 'projectSignals') ?? true,
            origin: 'manual_retry' as const,
          },
        }
      }

      case 'asset-intelligence-reconcile': {
        return {
          queueName: ASSET_INTELLIGENCE_RECONCILE_QUEUE,
          jobName: 'asset-intelligence-reconcile',
          payload: {
            tenantId: run.tenantId!,
            requestId: requestId ?? stringMetadata(run.metadata, 'requestId'),
            limit: numberMetadata(run.metadata, 'limit'),
            source: stringMetadata(run.metadata, 'source'),
            dryRun: booleanMetadata(run.metadata, 'dryRun') ?? false,
            highPriorityOnly: booleanMetadata(run.metadata, 'highPriorityOnly') ?? false,
            includeManualActions: booleanMetadata(run.metadata, 'includeManualActions') ?? true,
            allowAutomationWithConflicts:
              booleanMetadata(run.metadata, 'allowAutomationWithConflicts') ?? false,
            maxActionsPerAsset: numberMetadata(run.metadata, 'maxActionsPerAsset'),
            recentActionCooldownHours: numberMetadata(run.metadata, 'recentActionCooldownHours'),
            useNationalCoherence: booleanMetadata(run.metadata, 'useNationalCoherence') ?? true,
            origin: 'manual_retry' as const,
          },
        }
      }

      case 'siop-open-data-sync': {
        return {
          queueName: SIOP_OPEN_DATA_SYNC_QUEUE,
          jobName: 'siop-open-data-sync',
          payload: {
            tenantId: run.tenantId!,
            requestId: requestId ?? stringMetadata(run.metadata, 'requestId'),
            years: numberArrayMetadata(run.metadata, 'years'),
            download: booleanMetadata(run.metadata, 'download') ?? true,
            enqueueImports: booleanMetadata(run.metadata, 'enqueueImports') ?? true,
            origin: 'manual_retry' as const,
          },
        }
      }

      case 'tjsp-precatorio-sync': {
        return {
          queueName: TJSP_PRECATORIO_SYNC_QUEUE,
          jobName: 'tjsp-precatorio-sync',
          payload: {
            tenantId: run.tenantId!,
            requestId: requestId ?? stringMetadata(run.metadata, 'requestId'),
            categories: stringArrayMetadata(run.metadata, 'categories'),
            limit: numberMetadata(run.metadata, 'limit'),
            downloadDetails: booleanMetadata(run.metadata, 'downloadDetails') ?? true,
            downloadDocuments: booleanMetadata(run.metadata, 'downloadDocuments') ?? true,
            importDocuments: booleanMetadata(run.metadata, 'importDocuments') ?? true,
            origin: 'manual_retry' as const,
          },
        }
      }

      case 'tribunal-source-sync': {
        return {
          queueName: TRIBUNAL_SOURCE_SYNC_QUEUE,
          jobName: 'tribunal-source-sync',
          payload: {
            tenantId: run.tenantId!,
            requestId: requestId ?? stringMetadata(run.metadata, 'requestId'),
            targetKeys: stringArrayMetadata(run.metadata, 'targetKeys'),
            sourceDatasetKeys: stringArrayMetadata(run.metadata, 'sourceDatasetKeys'),
            courtAliases: stringArrayMetadata(run.metadata, 'courtAliases'),
            adapterKeys: stringArrayMetadata(run.metadata, 'adapterKeys'),
            statuses: stringArrayMetadata(run.metadata, 'statuses'),
            limit: numberMetadata(run.metadata, 'limit'),
            genericTribunalLimit: numberMetadata(run.metadata, 'genericTribunalLimit'),
            genericTribunalDownloadLinkedDocuments:
              booleanMetadata(run.metadata, 'genericTribunalDownloadLinkedDocuments') ?? true,
            genericTribunalImportLimit: numberMetadata(run.metadata, 'genericTribunalImportLimit'),
            tjbaPageSize: numberMetadata(run.metadata, 'tjbaPageSize'),
            tjbaMaxPages: numberMetadata(run.metadata, 'tjbaMaxPages'),
            tjbaImportLimit: numberMetadata(run.metadata, 'tjbaImportLimit'),
            tjesDebtorLimit: numberMetadata(run.metadata, 'tjesDebtorLimit'),
            tjesPageSize: numberMetadata(run.metadata, 'tjesPageSize'),
            tjesMaxPagesPerDebtor: numberMetadata(run.metadata, 'tjesMaxPagesPerDebtor'),
            tjesImportLimit: numberMetadata(run.metadata, 'tjesImportLimit'),
            tjmaYears: numberArrayMetadata(run.metadata, 'tjmaYears'),
            tjmaKinds: stringArrayMetadata(run.metadata, 'tjmaKinds'),
            tjmaLimit: numberMetadata(run.metadata, 'tjmaLimit'),
            tjmaImportLimit: numberMetadata(run.metadata, 'tjmaImportLimit'),
            tjrjAnnualMapImportLimit: numberMetadata(run.metadata, 'tjrjAnnualMapImportLimit'),
            trf1Years: numberArrayMetadata(run.metadata, 'trf1Years'),
            trf1Kinds: stringArrayMetadata(run.metadata, 'trf1Kinds'),
            trf1Limit: numberMetadata(run.metadata, 'trf1Limit'),
            trf1ImportLimit: numberMetadata(run.metadata, 'trf1ImportLimit'),
            trf1ImportChunkSize: numberMetadata(run.metadata, 'trf1ImportChunkSize'),
            trf3Years: numberArrayMetadata(run.metadata, 'trf3Years'),
            trf3Months: numberArrayMetadata(run.metadata, 'trf3Months'),
            trf3Formats: stringArrayMetadata(run.metadata, 'trf3Formats'),
            trf3Limit: numberMetadata(run.metadata, 'trf3Limit'),
            trf3ImportLimit: numberMetadata(run.metadata, 'trf3ImportLimit'),
            trf3ImportChunkSize: numberMetadata(run.metadata, 'trf3ImportChunkSize'),
            trf4ImportLimit: numberMetadata(run.metadata, 'trf4ImportLimit'),
            trf4ImportChunkSize: numberMetadata(run.metadata, 'trf4ImportChunkSize'),
            trf5Years: numberArrayMetadata(run.metadata, 'trf5Years'),
            trf5Kinds: stringArrayMetadata(run.metadata, 'trf5Kinds'),
            trf5Limit: numberMetadata(run.metadata, 'trf5Limit'),
            trf5ImportLimit: numberMetadata(run.metadata, 'trf5ImportLimit'),
            trf5ImportChunkSize: numberMetadata(run.metadata, 'trf5ImportChunkSize'),
            trf6Years: numberArrayMetadata(run.metadata, 'trf6Years'),
            trf6Limit: numberMetadata(run.metadata, 'trf6Limit'),
            trf6ImportLimit: numberMetadata(run.metadata, 'trf6ImportLimit'),
            trf6ImportChunkSize: numberMetadata(run.metadata, 'trf6ImportChunkSize'),
            postImportOperationalLimit: numberMetadata(run.metadata, 'postImportOperationalLimit'),
            postImportCreateOpportunities:
              booleanMetadata(run.metadata, 'postImportCreateOpportunities') ?? true,
            dryRun: booleanMetadata(run.metadata, 'dryRun') ?? false,
            origin: 'manual_retry' as const,
          },
        }
      }

      case 'government-data-sync-orchestrator': {
        return {
          queueName: GOVERNMENT_DATA_SYNC_ORCHESTRATOR_QUEUE,
          jobName: 'government-data-sync-orchestrator',
          payload: {
            tenantId: run.tenantId!,
            requestId: requestId ?? stringMetadata(run.metadata, 'requestId'),
            years: numberArrayMetadata(run.metadata, 'years'),
            dataJudCourtAliases: stringArrayMetadata(run.metadata, 'dataJudCourtAliases'),
            dataJudPageSize: numberMetadata(run.metadata, 'dataJudPageSize'),
            dataJudMaxPagesPerCourt: numberMetadata(run.metadata, 'dataJudMaxPagesPerCourt'),
            djenCourtAliases: stringArrayMetadata(run.metadata, 'djenCourtAliases'),
            djenSearchTexts: stringArrayMetadata(run.metadata, 'djenSearchTexts'),
            djenStartDate: stringMetadata(run.metadata, 'djenStartDate'),
            djenEndDate: stringMetadata(run.metadata, 'djenEndDate'),
            djenMaxPagesPerCourt: numberMetadata(run.metadata, 'djenMaxPagesPerCourt'),
            tjspCategories: stringArrayMetadata(run.metadata, 'tjspCategories'),
            tjspLimit: numberMetadata(run.metadata, 'tjspLimit'),
            tjspImportDocuments: booleanMetadata(run.metadata, 'tjspImportDocuments') ?? true,
            enrichLimit: numberMetadata(run.metadata, 'enrichLimit'),
            linkLimit: numberMetadata(run.metadata, 'linkLimit'),
            signalLimit: numberMetadata(run.metadata, 'signalLimit'),
            publicationLimit: numberMetadata(run.metadata, 'publicationLimit'),
            matchLimit: numberMetadata(run.metadata, 'matchLimit'),
            candidatesPerAsset: numberMetadata(run.metadata, 'candidatesPerAsset'),
            source: stringMetadata(run.metadata, 'source'),
            dryRun: booleanMetadata(run.metadata, 'dryRun') ?? false,
            origin: 'manual_retry' as const,
          },
        }
      }

      case 'trf6-manual-export-import': {
        const sourceRecordId = stringMetadata(run.metadata, 'sourceRecordId')
        if (!sourceRecordId) {
          throw new JobRetryError(
            'missing_metadata',
            'TRF6 manual export retry requires sourceRecordId metadata.'
          )
        }

        return {
          queueName: TRF6_MANUAL_EXPORT_IMPORT_QUEUE,
          jobName: 'trf6-manual-export-import',
          payload: {
            tenantId: run.tenantId!,
            sourceRecordId,
            maxRows: numberMetadata(run.metadata, 'maxRows'),
            chunkSize: numberMetadata(run.metadata, 'chunkSize') ?? 500,
            requestId: requestId ?? stringMetadata(run.metadata, 'requestId'),
            origin: 'manual_retry' as const,
            enqueuePostImportEnrichment: true,
          },
        }
      }

      case 'post-import-enrichment': {
        return {
          queueName: POST_IMPORT_ENRICHMENT_QUEUE,
          jobName: 'post-import-enrichment',
          payload: {
            tenantId: run.tenantId!,
            assetIds: stringArrayMetadata(run.metadata, 'assetIds'),
            sourceRecordId: stringMetadata(run.metadata, 'sourceRecordId'),
            source: stringMetadata(run.metadata, 'source'),
            enrichmentLimit: numberMetadata(run.metadata, 'enrichmentLimit'),
            linkLimit: numberMetadata(run.metadata, 'linkLimit'),
            signalLimit: numberMetadata(run.metadata, 'signalLimit'),
            publicationLimit: numberMetadata(run.metadata, 'publicationLimit'),
            matchLimit: numberMetadata(run.metadata, 'matchLimit'),
            candidatesPerAsset: numberMetadata(run.metadata, 'candidatesPerAsset'),
            requestId: requestId ?? stringMetadata(run.metadata, 'requestId'),
            origin: 'manual_retry' as const,
          },
        }
      }

      default:
        throw new JobRetryError('unsupported_job', `Job '${run.jobName}' does not support retry.`)
    }
  }
}

function stringMetadata(metadata: JsonRecord | null, key: string) {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function numberMetadata(metadata: JsonRecord | null, key: string) {
  const value = metadata?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function booleanMetadata(metadata: JsonRecord | null, key: string) {
  const value = metadata?.[key]
  return typeof value === 'boolean' ? value : null
}

function stringArrayMetadata(metadata: JsonRecord | null, key: string) {
  const value = metadata?.[key]
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : null
}

function numberArrayMetadata(metadata: JsonRecord | null, key: string) {
  const value = metadata?.[key]
  return Array.isArray(value) && value.every((item) => typeof item === 'number') ? value : null
}

export { JobRetryError }
export default new JobRetryService()
