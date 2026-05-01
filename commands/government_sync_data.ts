import { DateTime } from 'luxon'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import {
  GOVERNMENT_DATA_SYNC_ORCHESTRATOR_QUEUE,
  handleGovernmentDataSyncOrchestrator,
  type GovernmentDataSyncOrchestratorPayload,
} from '#modules/integrations/jobs/government_data_sync_orchestrator_handler'
import { normalizeAliases } from '#modules/integrations/services/datajud_asset_enrichment_service'
import queueService from '#shared/services/queue_service'

export default class GovernmentSyncData extends BaseCommand {
  static commandName = 'government:sync-data'
  static description = 'Run the government data sync pipeline for SIOP, DataJud, and matching'
  static options = {
    startApp: true,
  }

  @flags.string({
    description: 'Tenant id that will own the synchronized government records',
  })
  declare tenantId?: string

  @flags.string({
    description: 'Comma-separated SIOP years. Defaults to current and next year',
  })
  declare years?: string

  @flags.string({
    description: 'Comma-separated DataJud court aliases. Omit to scan all official aliases',
  })
  declare courts?: string

  @flags.number({
    description: 'Page size per DataJud court request',
  })
  declare datajudPageSize?: number

  @flags.number({
    description: 'Maximum DataJud pages to read per court',
  })
  declare datajudMaxPagesPerCourt?: number

  @flags.number({
    description: 'Maximum assets to enrich from DataJud after discovery',
  })
  declare enrichLimit?: number

  @flags.number({
    description: 'Maximum unlinked DataJud processes to link to assets by exact CNJ',
  })
  declare linkLimit?: number

  @flags.number({
    description: 'Maximum DataJud movements to classify into legal signals',
  })
  declare signalLimit?: number

  @flags.number({
    description: 'Maximum assets to match against DataJud candidates',
  })
  declare matchLimit?: number

  @flags.boolean({
    description: 'Preview pipeline phases without downloading or mutating data',
  })
  declare dryRun: boolean

  @flags.boolean({
    description: 'Run inline instead of enqueueing a BullMQ job',
  })
  declare runInline: boolean

  async run() {
    if (!this.tenantId) {
      this.logger.error('--tenant-id is required.')
      this.exitCode = 1
      return
    }

    const payload: GovernmentDataSyncOrchestratorPayload = {
      tenantId: this.tenantId,
      years: parseYears(this.years),
      dataJudCourtAliases: normalizeAliases(this.courts?.split(',')),
      dataJudPageSize: this.datajudPageSize,
      dataJudMaxPagesPerCourt: this.datajudMaxPagesPerCourt,
      enrichLimit: this.enrichLimit,
      linkLimit: this.linkLimit,
      signalLimit: this.signalLimit,
      matchLimit: this.matchLimit,
      dryRun: this.dryRun,
      origin: 'manual_retry',
    }

    if (this.runInline) {
      const result = await handleGovernmentDataSyncOrchestrator(payload)
      this.logger.info(`Government data sync completed inline: ${JSON.stringify(result)}`)
      return
    }

    const job = await queueService.add(
      GOVERNMENT_DATA_SYNC_ORCHESTRATOR_QUEUE,
      'government-data-sync-orchestrator',
      payload,
      {
        jobId: `government-data-sync-${this.tenantId}-${DateTime.utc().toMillis()}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    )

    this.logger.info(
      `Government data sync enqueued: ${JSON.stringify({
        tenantId: this.tenantId,
        jobId: job.id,
      })}`
    )

    await queueService.shutdown()
  }
}

function parseYears(value?: string) {
  if (!value?.trim()) {
    return undefined
  }

  return value
    .split(',')
    .map((year) => Number(year.trim()))
    .filter((year) => Number.isInteger(year))
}
