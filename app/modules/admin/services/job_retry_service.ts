import { EXPORT_PRECATORIOS_QUEUE } from '#modules/exports/jobs/export_precatorios_handler'
import { DATAJUD_ENRICH_ASSETS_QUEUE } from '#modules/integrations/jobs/datajud_enrich_assets_handler'
import { DATAJUD_MATCH_CANDIDATES_QUEUE } from '#modules/integrations/jobs/datajud_match_candidates_handler'
import { SIOP_IMPORT_QUEUE } from '#modules/siop/jobs/siop_import_handler'
import { TRF6_MANUAL_EXPORT_IMPORT_QUEUE } from '#modules/integrations/jobs/trf6_manual_export_import_handler'
import { POST_IMPORT_ENRICHMENT_QUEUE } from '#modules/integrations/jobs/post_import_enrichment_handler'
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
            limit: numberMetadata(run.metadata, 'limit'),
            source: stringMetadata(run.metadata, 'source'),
            missingOnly: booleanMetadata(run.metadata, 'missingOnly') ?? true,
            courtAliases: stringArrayMetadata(run.metadata, 'courtAliases'),
            dryRun: booleanMetadata(run.metadata, 'dryRun') ?? false,
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
            source: stringMetadata(run.metadata, 'source'),
            limit: numberMetadata(run.metadata, 'limit'),
            candidatesPerAsset: numberMetadata(run.metadata, 'candidatesPerAsset'),
            persist: booleanMetadata(run.metadata, 'persist') ?? true,
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

export { JobRetryError }
export default new JobRetryService()
