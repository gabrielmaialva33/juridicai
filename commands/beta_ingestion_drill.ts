import { BaseCommand, flags } from '@adonisjs/core/ace'
import betaIngestionDrillService from '#modules/admin/services/beta_ingestion_drill_service'
import queueService from '#shared/services/queue_service'
import type { SourceType } from '#shared/types/model_enums'

export default class BetaIngestionDrill extends BaseCommand {
  static commandName = 'beta:ingestion-drill'
  static description =
    'Run a conservative real-data ingestion drill and compare beta readiness before and after'
  static options = {
    startApp: true,
  }

  @flags.string({
    description: 'Tenant id to inspect and populate. Defaults to the local bootstrap tenant slug.',
  })
  declare tenantId?: string

  @flags.string({
    description: 'Tenant slug to inspect when --tenant-id is not provided.',
  })
  declare tenantSlug?: string

  @flags.string({
    description: 'Comma-separated SIOP years. Defaults to the current year.',
  })
  declare years?: string

  @flags.boolean({
    description:
      'Use the orchestrator full SIOP backfill range instead of current/constrained years.',
  })
  declare fullBackfill: boolean

  @flags.string({
    description: 'Comma-separated DataJud court aliases. Omit to use the scheduled national batch.',
  })
  declare courts?: string

  @flags.number({
    description: 'DataJud page size per court.',
  })
  declare datajudPageSize?: number

  @flags.number({
    description: 'Maximum DataJud pages per court.',
  })
  declare datajudMaxPagesPerCourt?: number

  @flags.string({
    description: 'Comma-separated DJEN court aliases. Omit to mirror the DataJud batch.',
  })
  declare djenCourts?: string

  @flags.string({
    description: 'Comma-separated DJEN text searches.',
  })
  declare djenTexts?: string

  @flags.string({
    description: 'DJEN start date in ISO format. Defaults to seven days before command time.',
  })
  declare djenStartDate?: string

  @flags.string({
    description: 'DJEN end date in ISO format. Defaults to command date.',
  })
  declare djenEndDate?: string

  @flags.number({
    description: 'Maximum DJEN pages per court/search.',
  })
  declare djenMaxPagesPerCourt?: number

  @flags.number({
    description: 'Maximum TJSP communication pages.',
  })
  declare tjspLimit?: number

  @flags.number({
    description: 'Maximum assets to enrich from DataJud after discovery.',
  })
  declare enrichLimit?: number

  @flags.number({
    description: 'Maximum DataJud processes to link by exact CNJ.',
  })
  declare linkLimit?: number

  @flags.number({
    description: 'Maximum DataJud movements to classify into legal signals.',
  })
  declare signalLimit?: number

  @flags.number({
    description: 'Maximum publications to classify into operational signals.',
  })
  declare publicationLimit?: number

  @flags.number({
    description: 'Maximum assets to match against DataJud candidates.',
  })
  declare matchLimit?: number

  @flags.number({
    description: 'Maximum DataJud candidates retained per asset.',
  })
  declare candidatesPerAsset?: number

  @flags.number({
    description: 'HTTP timeout in seconds for each government source request.',
  })
  declare fetchTimeoutSeconds?: number

  @flags.string({
    description:
      'Optional asset source filter for enrichment/matching, for example siop or tribunal.',
  })
  declare source?: SourceType

  @flags.boolean({
    description: 'Preview the drill without downloading or mutating ingestion data.',
  })
  declare dryRun: boolean

  @flags.boolean({
    description: 'Emit raw JSON only.',
  })
  declare json: boolean

  @flags.boolean({
    description: 'Exit with code 1 when the final readiness has failures.',
  })
  declare strict: boolean

  async run() {
    try {
      const report = await betaIngestionDrillService.run({
        tenantId: this.tenantId,
        tenantSlug: this.tenantSlug,
        years: parseYears(this.years),
        fullBackfill: this.fullBackfill,
        dataJudCourtAliases: parseList(this.courts),
        dataJudPageSize: this.datajudPageSize,
        dataJudMaxPagesPerCourt: this.datajudMaxPagesPerCourt,
        djenCourtAliases: parseList(this.djenCourts),
        djenSearchTexts: parseList(this.djenTexts),
        djenStartDate: this.djenStartDate,
        djenEndDate: this.djenEndDate,
        djenMaxPagesPerCourt: this.djenMaxPagesPerCourt,
        tjspLimit: this.tjspLimit,
        enrichLimit: this.enrichLimit,
        linkLimit: this.linkLimit,
        signalLimit: this.signalLimit,
        publicationLimit: this.publicationLimit,
        matchLimit: this.matchLimit,
        candidatesPerAsset: this.candidatesPerAsset,
        fetchTimeoutSeconds: this.fetchTimeoutSeconds,
        source: this.source,
        dryRun: this.dryRun,
        origin: 'manual_retry',
      })

      if (this.json) {
        this.logger.info(JSON.stringify(report, null, 2))
      } else {
        this.logger.info(`Beta ingestion drill completed: ${report.readiness.after.status}`)
        this.logger.info(
          `Readiness: ${JSON.stringify({
            before: report.readiness.before.status,
            after: report.readiness.after.status,
            dryRun: report.dryRun,
          })}`
        )
        this.logger.info(`Data deltas: ${JSON.stringify(report.deltas)}`)

        if (report.readiness.after.nextActions.length > 0) {
          this.logger.info(`Next actions: ${JSON.stringify(report.readiness.after.nextActions)}`)
        }
      }

      if (
        report.readiness.after.status === 'fail' ||
        (this.strict && report.readiness.after.status !== 'pass')
      ) {
        this.exitCode = 1
      }
    } finally {
      await queueService.shutdown()
    }
  }
}

function parseYears(value?: string) {
  if (!value?.trim()) {
    return null
  }

  return value
    .split(',')
    .map((year) => Number(year.trim()))
    .filter((year) => Number.isInteger(year))
}

function parseList(value?: string) {
  if (!value?.trim()) {
    return null
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}
