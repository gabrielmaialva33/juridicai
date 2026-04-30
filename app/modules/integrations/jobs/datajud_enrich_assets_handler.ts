import dataJudAssetEnrichmentService from '#modules/integrations/services/datajud_asset_enrichment_service'
import tenantContext from '#shared/helpers/tenant_context'
import jobRunService from '#shared/services/job_run_service'
import type { JobRunOrigin, SourceType } from '#shared/types/model_enums'

export const DATAJUD_ENRICH_ASSETS_QUEUE = 'datajud-enrich-assets'

export type DataJudEnrichAssetsPayload = {
  tenantId: string
  limit?: number | null
  source?: SourceType | null
  missingOnly?: boolean
  courtAliases?: string[] | null
  dryRun?: boolean
  requestId?: string | null
  bullmqJobId?: string | null
  attempts?: number | null
  origin?: JobRunOrigin
}

export async function handleDataJudEnrichAssets(payload: DataJudEnrichAssetsPayload) {
  const run = await jobRunService.start({
    tenantId: payload.tenantId,
    jobName: 'datajud-enrich-assets',
    queueName: DATAJUD_ENRICH_ASSETS_QUEUE,
    bullmqJobId: payload.bullmqJobId ?? null,
    attempts: payload.attempts ?? null,
    origin: payload.origin ?? 'system',
    metadata: {
      requestId: payload.requestId ?? null,
      limit: payload.limit ?? null,
      source: payload.source ?? null,
      missingOnly: payload.missingOnly ?? true,
      courtAliases: payload.courtAliases ?? null,
      dryRun: payload.dryRun ?? false,
    },
  })

  try {
    const metrics = await tenantContext.run(
      {
        tenantId: payload.tenantId,
        requestId: payload.requestId ?? undefined,
      },
      () =>
        dataJudAssetEnrichmentService.enrich({
          tenantId: payload.tenantId,
          limit: payload.limit,
          source: payload.source,
          missingOnly: payload.missingOnly,
          courtAliases: payload.courtAliases,
          dryRun: payload.dryRun,
        })
    )

    await jobRunService.finish(run.id, 'completed', metrics)

    return metrics
  } catch (error) {
    await jobRunService.finish(run.id, 'failed', null, error)
    throw error
  }
}
