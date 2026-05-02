import dataJudAssetEnrichmentService from '#modules/integrations/services/datajud_asset_enrichment_service'
import dataJudCandidateMatchService from '#modules/integrations/services/datajud_candidate_match_service'
import dataJudLegalSignalClassifierService from '#modules/integrations/services/datajud_legal_signal_classifier_service'
import dataJudProcessAssetLinkService from '#modules/integrations/services/datajud_process_asset_link_service'
import publicationSignalClassifierService from '#modules/integrations/services/publication_signal_classifier_service'
import tenantContext from '#shared/helpers/tenant_context'
import jobRunService from '#shared/services/job_run_service'
import type { JobRunOrigin, SourceType } from '#shared/types/model_enums'

export const POST_IMPORT_ENRICHMENT_QUEUE = 'post-import-enrichment'

export type PostImportEnrichmentPayload = {
  tenantId: string
  sourceRecordId?: string | null
  source?: SourceType | null
  enrichmentLimit?: number | null
  linkLimit?: number | null
  signalLimit?: number | null
  publicationLimit?: number | null
  matchLimit?: number | null
  candidatesPerAsset?: number | null
  requestId?: string | null
  bullmqJobId?: string | null
  attempts?: number | null
  origin?: JobRunOrigin
}

export async function handlePostImportEnrichment(payload: PostImportEnrichmentPayload) {
  const run = await jobRunService.start({
    tenantId: payload.tenantId,
    jobName: 'post-import-enrichment',
    queueName: POST_IMPORT_ENRICHMENT_QUEUE,
    bullmqJobId: payload.bullmqJobId ?? null,
    attempts: payload.attempts ?? null,
    origin: payload.origin ?? 'system',
    metadata: {
      requestId: payload.requestId ?? null,
      sourceRecordId: payload.sourceRecordId ?? null,
      source: payload.source ?? null,
      enrichmentLimit: payload.enrichmentLimit ?? null,
      linkLimit: payload.linkLimit ?? null,
      signalLimit: payload.signalLimit ?? null,
      publicationLimit: payload.publicationLimit ?? null,
      matchLimit: payload.matchLimit ?? null,
      candidatesPerAsset: payload.candidatesPerAsset ?? null,
    },
  })

  try {
    const metrics = await tenantContext.run(
      {
        tenantId: payload.tenantId,
        requestId: payload.requestId ?? undefined,
      },
      () => enrichAfterImport(payload)
    )

    await jobRunService.finish(run.id, 'completed', metrics)

    return metrics
  } catch (error) {
    await jobRunService.finish(run.id, 'failed', null, error)
    throw error
  }
}

async function enrichAfterImport(payload: PostImportEnrichmentPayload) {
  const dataJudAssetEnrichment = await dataJudAssetEnrichmentService.enrich({
    tenantId: payload.tenantId,
    sourceRecordId: payload.sourceRecordId,
    source: payload.source,
    limit: payload.enrichmentLimit ?? 1_000,
    missingOnly: true,
    dryRun: false,
  })
  const dataJudExactAssetLinking = await dataJudProcessAssetLinkService.link({
    tenantId: payload.tenantId,
    limit: payload.linkLimit ?? 2_000,
    projectSignals: true,
  })
  const dataJudLegalSignalClassification = await dataJudLegalSignalClassifierService.classify({
    tenantId: payload.tenantId,
    limit: payload.signalLimit ?? 2_000,
    projectAssetEvents: true,
  })
  const publicationSignalClassification = await publicationSignalClassifierService.classify({
    tenantId: payload.tenantId,
    limit: payload.publicationLimit ?? 2_000,
    projectAssetEvents: true,
  })
  const dataJudCandidateMatching = await dataJudCandidateMatchService.match({
    tenantId: payload.tenantId,
    sourceRecordId: payload.sourceRecordId,
    source: payload.source,
    limit: payload.matchLimit ?? 500,
    candidatesPerAsset: payload.candidatesPerAsset ?? 3,
    persist: true,
  })

  return {
    sourceRecordId: payload.sourceRecordId ?? null,
    source: payload.source ?? null,
    dataJudAssetEnrichment,
    dataJudExactAssetLinking,
    dataJudLegalSignalClassification,
    publicationSignalClassification,
    dataJudCandidateMatching: dataJudCandidateMatching.stats,
  }
}
