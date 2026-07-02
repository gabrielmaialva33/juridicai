import { DateTime } from 'luxon'
import type CoverageRun from '#modules/integrations/models/coverage_run'
import coverageRunRepository from '#modules/integrations/repositories/coverage_run_repository'
import sourceDatasetRepository from '#modules/integrations/repositories/source_dataset_repository'
import type { JobRunOrigin, JobRunStatus, JsonRecord } from '#shared/types/model_enums'

type StartCoverageRunInput = {
  tenantId: string
  sourceDatasetKey?: string | null
  sourceDatasetId?: string | null
  sourceRecordId?: string | null
  origin?: JobRunOrigin
  scope?: JsonRecord | null
}

type FinishCoverageRunInput = {
  sourceRecordId?: string | null
  discoveredCount?: number | null
  sourceRecordsCount?: number | null
  createdAssetsCount?: number | null
  linkedAssetsCount?: number | null
  enrichedAssetsCount?: number | null
  errorCount?: number | null
  metrics?: JsonRecord | null
  error?: unknown
}

class CoverageRunService {
  async start(input: StartCoverageRunInput) {
    return coverageRunRepository.start(input.tenantId, {
      sourceDatasetId: await this.resolveSourceDatasetId(input),
      sourceRecordId: input.sourceRecordId ?? null,
      origin: input.origin ?? 'system',
      scope: input.scope ?? null,
      startedAt: DateTime.utc(),
    })
  }

  async finish(
    coverageRun: CoverageRun | string,
    status: Extract<JobRunStatus, 'completed' | 'failed' | 'skipped'>,
    input: FinishCoverageRunInput = {}
  ) {
    const run =
      typeof coverageRun === 'string'
        ? await coverageRunRepository.findAnyByIdOrFail(coverageRun)
        : coverageRun
    const errorMessage = this.serializeErrorMessage(input.error)

    run.merge({
      status,
      sourceRecordId: input.sourceRecordId ?? run.sourceRecordId,
      finishedAt: DateTime.utc(),
      discoveredCount: normalizeCount(input.discoveredCount, run.discoveredCount),
      sourceRecordsCount: normalizeCount(input.sourceRecordsCount, run.sourceRecordsCount),
      createdAssetsCount: normalizeCount(input.createdAssetsCount, run.createdAssetsCount),
      linkedAssetsCount: normalizeCount(input.linkedAssetsCount, run.linkedAssetsCount),
      enrichedAssetsCount: normalizeCount(input.enrichedAssetsCount, run.enrichedAssetsCount),
      errorCount: normalizeCount(input.errorCount, run.errorCount),
      metrics: input.metrics ?? run.metrics,
      errorMessage,
    })

    await run.save()

    return run
  }

  private async resolveSourceDatasetId(input: StartCoverageRunInput) {
    if (input.sourceDatasetId) {
      return input.sourceDatasetId
    }

    if (!input.sourceDatasetKey) {
      return null
    }

    return sourceDatasetRepository.findIdByKeyOrFail(input.sourceDatasetKey)
  }

  private serializeErrorMessage(error: unknown) {
    if (!error) {
      return null
    }

    if (error instanceof Error) {
      return error.message
    }

    return String(error)
  }
}

function normalizeCount(value: number | null | undefined, fallback: number) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback
  }

  return Math.max(0, Math.trunc(value))
}

export default new CoverageRunService()
