import dataJudCandidateMatchService from '#modules/integrations/services/datajud_candidate_match_service'
import tenantContext from '#shared/helpers/tenant_context'
import jobRunService from '#shared/services/job_run_service'
import type { JobRunOrigin, SourceType } from '#shared/types/model_enums'

export const DATAJUD_MATCH_CANDIDATES_QUEUE = 'datajud-match-candidates'

export type DataJudMatchCandidatesPayload = {
  tenantId: string
  sourceRecordId?: string | null
  source?: SourceType | null
  limit?: number | null
  candidatesPerAsset?: number | null
  persist?: boolean
  requestId?: string | null
  bullmqJobId?: string | null
  attempts?: number | null
  origin?: JobRunOrigin
}

export async function handleDataJudMatchCandidates(payload: DataJudMatchCandidatesPayload) {
  const run = await jobRunService.start({
    tenantId: payload.tenantId,
    jobName: 'datajud-match-candidates',
    queueName: DATAJUD_MATCH_CANDIDATES_QUEUE,
    bullmqJobId: payload.bullmqJobId ?? null,
    attempts: payload.attempts ?? null,
    origin: payload.origin ?? 'system',
    metadata: {
      requestId: payload.requestId ?? null,
      sourceRecordId: payload.sourceRecordId ?? null,
      source: payload.source ?? null,
      limit: payload.limit ?? null,
      candidatesPerAsset: payload.candidatesPerAsset ?? null,
      persist: payload.persist ?? false,
    },
  })

  try {
    const result = await tenantContext.run(
      {
        tenantId: payload.tenantId,
        requestId: payload.requestId ?? undefined,
      },
      () =>
        dataJudCandidateMatchService.match({
          tenantId: payload.tenantId,
          sourceRecordId: payload.sourceRecordId,
          source: payload.source,
          limit: payload.limit,
          candidatesPerAsset: payload.candidatesPerAsset,
          persist: payload.persist,
        })
    )

    await jobRunService.finish(run.id, 'completed', result.stats)

    return result
  } catch (error) {
    await jobRunService.finish(run.id, 'failed', null, error)
    throw error
  }
}
