import queueService from '#shared/services/queue_service'
import siopOpenDataAdapter from '#modules/integrations/services/siop_open_data_adapter'
import coverageRunService from '#modules/integrations/services/coverage_run_service'
import { SIOP_IMPORT_QUEUE } from '#modules/siop/jobs/siop_import_handler'
import type SiopImport from '#modules/siop/models/siop_import'
import type { JobRunOrigin } from '#shared/types/model_enums'

export type SiopOpenDataSyncServiceOptions = {
  tenantId: string
  years?: number[] | null
  download?: boolean
  enqueueImports?: boolean
  fetcher?: typeof fetch
  origin?: JobRunOrigin
}

export type SiopOpenDataImportEnqueueResult = {
  importId: string
  status: string
  enqueued: boolean
  jobId: string | number | null
}

export type SiopOpenDataSyncServiceResult = {
  discovered: number
  selected: number
  downloaded: number
  importsCreated: number
  importsReused: number
  importsEnqueued: number
  importsSkipped: number
  importJobs: SiopOpenDataImportEnqueueResult[]
}

class SiopOpenDataSyncService {
  async sync(options: SiopOpenDataSyncServiceOptions): Promise<SiopOpenDataSyncServiceResult> {
    const coverageRun = await coverageRunService.start({
      tenantId: options.tenantId,
      sourceDatasetKey: 'siop-open-data-precatorios',
      origin: options.origin ?? 'system',
      scope: {
        years: options.years ?? null,
        download: options.download ?? true,
        enqueueImports: options.enqueueImports ?? true,
      },
    })

    try {
      const result = await siopOpenDataAdapter.sync({
        tenantId: options.tenantId,
        years: options.years ?? undefined,
        download: options.download,
        fetcher: options.fetcher,
      })
      const importJobs =
        options.enqueueImports === false
          ? []
          : await this.enqueueImportJobs(
              options.tenantId,
              result.items
                .map((item) => item.siopImport)
                .filter((item): item is SiopImport => !!item)
            )

      const metrics = {
        discovered: result.discovered,
        selected: result.selected,
        downloaded: result.downloaded,
        importsCreated: result.importsCreated,
        importsReused: result.importsReused,
        importsEnqueued: importJobs.filter((item) => item.enqueued).length,
        importsSkipped: importJobs.filter((item) => !item.enqueued).length,
        importJobs,
      }

      await coverageRunService.finish(coverageRun, 'completed', {
        discoveredCount: metrics.discovered,
        sourceRecordsCount: metrics.downloaded,
        metrics,
      })

      return metrics
    } catch (error) {
      await coverageRunService.finish(coverageRun, 'failed', {
        error,
        errorCount: 1,
      })
      throw error
    }
  }

  private async enqueueImportJobs(tenantId: string, imports: SiopImport[]) {
    const jobs: SiopOpenDataImportEnqueueResult[] = []

    for (const importRow of imports) {
      if (!shouldEnqueueImport(importRow.status)) {
        jobs.push({
          importId: importRow.id,
          status: importRow.status,
          enqueued: false,
          jobId: null,
        })
        continue
      }

      const job = await queueService.add(
        SIOP_IMPORT_QUEUE,
        'siop-open-data-import',
        {
          tenantId,
          importId: importRow.id,
          origin: 'system',
        },
        {
          jobId: `siop-open-data-import-${tenantId}-${importRow.id}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        }
      )

      jobs.push({
        importId: importRow.id,
        status: importRow.status,
        enqueued: true,
        jobId: job.id ?? null,
      })
    }

    return jobs
  }
}

function shouldEnqueueImport(status: string) {
  return status === 'pending' || status === 'failed' || status === 'partial'
}

export default new SiopOpenDataSyncService()
