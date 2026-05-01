import { BaseCommand, flags } from '@adonisjs/core/ace'
import { DateTime } from 'luxon'
import queueService from '#shared/services/queue_service'
import {
  DATAJUD_ENRICH_ASSETS_QUEUE,
  handleDataJudEnrichAssets,
  type DataJudEnrichAssetsPayload,
} from '#modules/integrations/jobs/datajud_enrich_assets_handler'
import { normalizeAliases } from '#modules/integrations/services/datajud_asset_enrichment_service'
import type { SourceType } from '#shared/types/model_enums'

export default class DataJudEnrichAssets extends BaseCommand {
  static commandName = 'datajud:enrich-assets'
  static description = 'Enqueue or run DataJud enrichment for precatorio assets with CNJ numbers'
  static options = {
    startApp: true,
  }

  @flags.string({
    description: 'Tenant id that owns the assets to enrich',
  })
  declare tenantId?: string

  @flags.number({
    description: 'Maximum number of candidate assets to inspect',
  })
  declare limit?: number

  @flags.string({
    description: 'Optional asset source filter, for example "siop"',
  })
  declare source?: SourceType

  @flags.string({
    description:
      'Comma-separated DataJud court aliases. When omitted, each asset CNJ infers the court',
  })
  declare courts?: string

  @flags.boolean({
    description: 'Include assets that already have judicial process metadata',
  })
  declare includeExisting: boolean

  @flags.boolean({
    description: 'Run inline instead of enqueueing a BullMQ job',
  })
  declare runInline: boolean

  @flags.boolean({
    description: 'Inspect candidates without querying DataJud or persisting process metadata',
  })
  declare dryRun: boolean

  async run() {
    if (!this.tenantId) {
      this.logger.error('--tenant-id is required.')
      this.exitCode = 1
      return
    }

    const payload: DataJudEnrichAssetsPayload = {
      tenantId: this.tenantId,
      limit: this.limit,
      source: this.source,
      missingOnly: !this.includeExisting,
      courtAliases: normalizeAliases(this.courts?.split(',')),
      dryRun: this.dryRun,
      origin: 'manual_retry',
    }

    if (this.runInline || this.dryRun) {
      const metrics = await handleDataJudEnrichAssets(payload)
      this.logger.info(`DataJud asset enrichment completed inline: ${JSON.stringify(metrics)}`)
      return
    }

    const job = await queueService.add(
      DATAJUD_ENRICH_ASSETS_QUEUE,
      'datajud-enrich-assets',
      payload,
      {
        jobId: `datajud-enrich-assets-${this.tenantId}-${DateTime.utc().toMillis()}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    )

    this.logger.info(
      `DataJud asset enrichment enqueued: ${JSON.stringify({
        tenantId: this.tenantId,
        jobId: job.id,
        limit: this.limit ?? null,
        source: this.source ?? null,
        missingOnly: !this.includeExisting,
        dryRun: this.dryRun,
      })}`
    )

    await queueService.shutdown()
  }
}
