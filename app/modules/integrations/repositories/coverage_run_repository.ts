import BaseRepository from '#shared/repositories/base_repository'
import CoverageRun from '#modules/integrations/models/coverage_run'
import type { DateTime } from 'luxon'
import type { JobRunOrigin, JsonRecord } from '#shared/types/model_enums'

class CoverageRunRepository extends BaseRepository<typeof CoverageRun> {
  constructor() {
    super(CoverageRun)
  }

  start(
    tenantId: string,
    input: {
      sourceDatasetId?: string | null
      sourceRecordId?: string | null
      origin: JobRunOrigin
      scope?: JsonRecord | null
      startedAt: DateTime
    }
  ) {
    return this.create(tenantId, {
      sourceDatasetId: input.sourceDatasetId ?? null,
      sourceRecordId: input.sourceRecordId ?? null,
      status: 'running',
      origin: input.origin,
      scope: input.scope ?? null,
      startedAt: input.startedAt,
      discoveredCount: 0,
      sourceRecordsCount: 0,
      createdAssetsCount: 0,
      linkedAssetsCount: 0,
      enrichedAssetsCount: 0,
      errorCount: 0,
      metrics: null,
      errorMessage: null,
    })
  }

  findAnyByIdOrFail(id: string) {
    return CoverageRun.query().where('id', id).firstOrFail()
  }

  listRecentWithMetrics(tenantId: string, limit: number) {
    return this.query(tenantId).whereNotNull('metrics').orderBy('started_at', 'desc').limit(limit)
  }
}

export default new CoverageRunRepository()
