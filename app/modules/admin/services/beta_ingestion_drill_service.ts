import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import betaReadinessService from '#modules/admin/services/beta_readiness_service'
import {
  type GovernmentDataSyncOrchestratorPayload,
  handleGovernmentDataSyncOrchestrator,
} from '#modules/integrations/jobs/government_data_sync_orchestrator_handler'
import jobRunService from '#shared/services/job_run_service'
import type { JobRunOrigin, JsonRecord, SourceType } from '#shared/types/model_enums'

const DEFAULT_TENANT_SLUG = 'juridicai-local'
const DEFAULT_PAGE_SIZE = 25
const DEFAULT_MAX_PAGES_PER_COURT = 1
const DEFAULT_DJEN_DAYS = 7
const DEFAULT_TJSP_LIMIT = 2
const DEFAULT_ENRICH_LIMIT = 100
const DEFAULT_LINK_LIMIT = 250
const DEFAULT_SIGNAL_LIMIT = 500
const DEFAULT_PUBLICATION_LIMIT = 500
const DEFAULT_MATCH_LIMIT = 100
const DEFAULT_CANDIDATES_PER_ASSET = 2
const DEFAULT_FETCH_TIMEOUT_SECONDS = 20

type PipelineRunner = (payload: GovernmentDataSyncOrchestratorPayload) => Promise<JsonRecord>

export type BetaIngestionDrillOptions = {
  tenantId?: string | null
  tenantSlug?: string | null
  years?: number[] | null
  fullBackfill?: boolean
  dataJudCourtAliases?: string[] | null
  dataJudPageSize?: number | null
  dataJudMaxPagesPerCourt?: number | null
  djenCourtAliases?: string[] | null
  djenSearchTexts?: string[] | null
  djenStartDate?: string | null
  djenEndDate?: string | null
  djenMaxPagesPerCourt?: number | null
  tjspLimit?: number | null
  enrichLimit?: number | null
  linkLimit?: number | null
  signalLimit?: number | null
  publicationLimit?: number | null
  matchLimit?: number | null
  candidatesPerAsset?: number | null
  fetchTimeoutSeconds?: number | null
  source?: SourceType | null
  dryRun?: boolean
  requestId?: string | null
  origin?: JobRunOrigin
  now?: DateTime
}

class BetaIngestionDrillService {
  constructor(
    private readonly pipelineRunner: PipelineRunner = handleGovernmentDataSyncOrchestrator
  ) {}

  async run(options: BetaIngestionDrillOptions = {}) {
    const now = options.now ?? DateTime.utc()
    const dryRun = options.dryRun ?? false
    const tenant = await resolveTenant(options)

    if (!tenant) {
      throw new Error(
        options.tenantId
          ? `Tenant ${options.tenantId} was not found or is not active.`
          : `Tenant ${options.tenantSlug ?? DEFAULT_TENANT_SLUG} was not found or is not active.`
      )
    }

    const pipelinePayload = buildPipelinePayload({
      ...options,
      tenantId: String(tenant.id),
      dryRun,
      origin: options.origin ?? 'manual_retry',
      now,
    })
    const before = await betaReadinessService.build({
      tenantId: String(tenant.id),
      now,
    })
    const run = await jobRunService.start({
      tenantId: String(tenant.id),
      jobName: 'beta-ingestion-drill',
      queueName: null,
      origin: options.origin ?? 'manual_retry',
      metadata: {
        dryRun,
        requestId: options.requestId ?? null,
        pipelinePayload,
      },
    })

    try {
      const pipeline = await this.pipelineRunner(pipelinePayload)
      const after = await betaReadinessService.build({
        tenantId: String(tenant.id),
        now: DateTime.utc(),
      })
      const metrics = {
        dryRun,
        tenant: {
          id: String(tenant.id),
          slug: String(tenant.slug),
        },
        startedAt: now.toISO(),
        finishedAt: DateTime.utc().toISO(),
        readiness: {
          before: readinessSummary(before),
          after: readinessSummary(after),
        },
        deltas: evidenceDeltas(before, after),
        pipeline,
      }

      await jobRunService.finish(run.id, 'completed', metrics)

      return metrics
    } catch (error) {
      await jobRunService.finish(run.id, 'failed', null, error)
      throw error
    }
  }
}

function buildPipelinePayload(
  options: BetaIngestionDrillOptions & { tenantId: string; dryRun: boolean; now: DateTime }
): GovernmentDataSyncOrchestratorPayload {
  const djenEndDate = options.djenEndDate ?? options.now.toISODate()
  const djenStartDate =
    options.djenStartDate ?? options.now.minus({ days: DEFAULT_DJEN_DAYS }).toISODate()

  return {
    tenantId: options.tenantId,
    years: options.fullBackfill ? null : normalizeYears(options.years, options.now),
    dataJudCourtAliases: normalizeList(options.dataJudCourtAliases),
    dataJudPageSize: options.dataJudPageSize ?? DEFAULT_PAGE_SIZE,
    dataJudMaxPagesPerCourt: options.dataJudMaxPagesPerCourt ?? DEFAULT_MAX_PAGES_PER_COURT,
    djenCourtAliases: normalizeList(options.djenCourtAliases),
    djenSearchTexts: normalizeList(options.djenSearchTexts) ?? ['precatório', 'RPV'],
    djenStartDate,
    djenEndDate,
    djenMaxPagesPerCourt: options.djenMaxPagesPerCourt ?? DEFAULT_MAX_PAGES_PER_COURT,
    tjspCategories: ['state_entities', 'municipal_entities', 'inss'],
    tjspLimit: options.tjspLimit ?? DEFAULT_TJSP_LIMIT,
    tjspImportDocuments: true,
    enrichLimit: options.enrichLimit ?? DEFAULT_ENRICH_LIMIT,
    linkLimit: options.linkLimit ?? DEFAULT_LINK_LIMIT,
    signalLimit: options.signalLimit ?? DEFAULT_SIGNAL_LIMIT,
    publicationLimit: options.publicationLimit ?? DEFAULT_PUBLICATION_LIMIT,
    matchLimit: options.matchLimit ?? DEFAULT_MATCH_LIMIT,
    candidatesPerAsset: options.candidatesPerAsset ?? DEFAULT_CANDIDATES_PER_ASSET,
    fetchTimeoutMs: timeoutMs(options.fetchTimeoutSeconds),
    source: options.source ?? null,
    dryRun: options.dryRun,
    requestId: options.requestId ?? null,
    origin: options.origin ?? 'manual_retry',
  }
}

function timeoutMs(seconds: number | null | undefined) {
  return Math.trunc((seconds ?? DEFAULT_FETCH_TIMEOUT_SECONDS) * 1000)
}

async function resolveTenant(options: BetaIngestionDrillOptions) {
  const query = db.from('tenants').where('status', 'active')

  if (options.tenantId) {
    query.where('id', options.tenantId)
  } else {
    query.where('slug', options.tenantSlug ?? DEFAULT_TENANT_SLUG)
  }

  return query.first()
}

function normalizeYears(years: number[] | null | undefined, now: DateTime) {
  if (!years?.length) {
    return [now.year]
  }

  return [...new Set(years.map((year) => Math.trunc(year)).filter((year) => year >= 2008))]
}

function normalizeList<T extends string>(items: T[] | null | undefined) {
  const normalized = items?.map((item) => item.trim()).filter(Boolean)

  return normalized?.length ? normalized : null
}

function readinessSummary(report: Awaited<ReturnType<typeof betaReadinessService.build>>) {
  return {
    status: report.status,
    summary: report.summary,
    nextActions: report.nextActions,
  }
}

function evidenceDeltas(
  before: Awaited<ReturnType<typeof betaReadinessService.build>>,
  after: Awaited<ReturnType<typeof betaReadinessService.build>>
) {
  const beforeCounts = evidenceCounts(before)
  const afterCounts = evidenceCounts(after)
  const keys = [...new Set([...Object.keys(beforeCounts), ...Object.keys(afterCounts)])].sort()

  return keys.reduce<Record<string, { before: number; after: number; delta: number }>>(
    (result, key) => {
      const beforeValue = beforeCounts[key] ?? 0
      const afterValue = afterCounts[key] ?? 0
      result[key] = {
        before: beforeValue,
        after: afterValue,
        delta: afterValue - beforeValue,
      }

      return result
    },
    {}
  )
}

function evidenceCounts(report: Awaited<ReturnType<typeof betaReadinessService.build>>) {
  const dataSection = report.sections.find((section) => section.key === 'data_evidence')

  return (dataSection?.checks ?? []).reduce<Record<string, number>>((result, check) => {
    if (typeof check.actual === 'number') {
      result[check.key.replace(/^data\./, '')] = check.actual
    }

    return result
  }, {})
}

export { BetaIngestionDrillService }
export default new BetaIngestionDrillService()
