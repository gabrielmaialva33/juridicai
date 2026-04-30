import { EXPORT_PRECATORIOS_QUEUE } from '#modules/exports/jobs/export_precatorios_handler'
import { SIOP_IMPORT_QUEUE } from '#modules/siop/jobs/siop_import_handler'
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

      default:
        throw new JobRetryError('unsupported_job', `Job '${run.jobName}' does not support retry.`)
    }
  }
}

function stringMetadata(metadata: JsonRecord | null, key: string) {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

export { JobRetryError }
export default new JobRetryService()
