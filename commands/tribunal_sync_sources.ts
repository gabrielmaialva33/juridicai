import { DateTime } from 'luxon'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import {
  TRIBUNAL_SOURCE_SYNC_QUEUE,
  handleTribunalSourceSync,
  type TribunalSourceSyncPayload,
} from '#modules/integrations/jobs/tribunal_source_sync_handler'
import queueService from '#shared/services/queue_service'

export default class TribunalSyncSources extends BaseCommand {
  static commandName = 'tribunal:sync-sources'
  static description = 'Sync configured tribunal/government source targets into canonical records'
  static options = {
    startApp: true,
  }

  @flags.string({
    description: 'Tenant id that will own synchronized records',
  })
  declare tenantId?: string

  @flags.string({
    description: 'Comma-separated government_source_targets.key values',
  })
  declare targets?: string

  @flags.string({
    description: 'Comma-separated source_datasets.key values',
  })
  declare datasets?: string

  @flags.string({
    description: 'Comma-separated court aliases',
  })
  declare courts?: string

  @flags.string({
    description: 'Comma-separated adapter keys',
  })
  declare adapters?: string

  @flags.number({
    description: 'Maximum targets to inspect',
  })
  declare limit?: number

  @flags.number({
    description: 'Maximum DataJud pages per court target',
  })
  declare datajudMaxPagesPerCourt?: number

  @flags.number({
    description: 'Maximum DJEN pages per court target',
  })
  declare djenMaxPagesPerCourt?: number

  @flags.number({
    description: 'Maximum TJSP communication pages to process',
  })
  declare tjspLimit?: number

  @flags.string({
    description: 'Comma-separated TRF2 years',
  })
  declare trf2Years?: string

  @flags.number({
    description: 'Maximum grouped TRF4 precatorios to import per downloaded queue file',
  })
  declare trf4ImportLimit?: number

  @flags.number({
    description: 'TRF4 grouped precatorios processed per import batch',
  })
  declare trf4ImportChunkSize?: number

  @flags.string({
    description: 'Comma-separated TRF5 years',
  })
  declare trf5Years?: string

  @flags.string({
    description: 'Comma-separated TRF5 source kinds: paid_precatorios,federal_debt',
  })
  declare trf5Kinds?: string

  @flags.number({
    description: 'Maximum TRF5 PDFs to download',
  })
  declare trf5Limit?: number

  @flags.number({
    description: 'Maximum TRF5 rows to import per downloaded PDF',
  })
  declare trf5ImportLimit?: number

  @flags.number({
    description: 'TRF5 parsed rows processed per import batch',
  })
  declare trf5ImportChunkSize?: number

  @flags.boolean({
    description: 'Preview selected targets without downloading or mutating data',
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

    const payload: TribunalSourceSyncPayload = {
      tenantId: this.tenantId,
      targetKeys: splitList(this.targets),
      sourceDatasetKeys: splitList(this.datasets),
      courtAliases: splitList(this.courts),
      adapterKeys: splitList(this.adapters),
      limit: this.limit,
      dataJudMaxPagesPerCourt: this.datajudMaxPagesPerCourt,
      djenMaxPagesPerCourt: this.djenMaxPagesPerCourt,
      tjspLimit: this.tjspLimit,
      trf2Years: parseYears(this.trf2Years),
      trf4ImportLimit: this.trf4ImportLimit,
      trf4ImportChunkSize: this.trf4ImportChunkSize,
      trf5Years: parseYears(this.trf5Years),
      trf5Kinds: parseTrf5Kinds(this.trf5Kinds),
      trf5Limit: this.trf5Limit,
      trf5ImportLimit: this.trf5ImportLimit,
      trf5ImportChunkSize: this.trf5ImportChunkSize,
      dryRun: this.dryRun,
      origin: 'manual_retry',
    }

    if (this.runInline) {
      const result = await handleTribunalSourceSync(payload)
      this.logger.info(`Tribunal source sync completed inline: ${JSON.stringify(result)}`)
      return
    }

    const job = await queueService.add(
      TRIBUNAL_SOURCE_SYNC_QUEUE,
      'tribunal-source-sync',
      payload,
      {
        jobId: `tribunal-source-sync-${this.tenantId}-${DateTime.utc().toMillis()}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    )

    this.logger.info(
      `Tribunal source sync enqueued: ${JSON.stringify({
        tenantId: this.tenantId,
        jobId: job.id,
      })}`
    )

    await queueService.shutdown()
  }
}

function splitList(value?: string) {
  if (!value?.trim()) {
    return undefined
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseYears(value?: string) {
  return splitList(value)
    ?.map((year) => Number(year))
    .filter((year) => Number.isInteger(year))
}

function parseTrf5Kinds(value?: string) {
  const allowed = new Set(['paid_precatorios', 'federal_debt'])

  return splitList(value)?.filter((kind) => allowed.has(kind)) as
    | Array<'paid_precatorios' | 'federal_debt'>
    | undefined
}
