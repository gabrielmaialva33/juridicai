import { DateTime } from 'luxon'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import {
  TJSP_PRECATORIO_SYNC_QUEUE,
  handleTjspPrecatorioSync,
  type TjspPrecatorioSyncPayload,
} from '#modules/integrations/jobs/tjsp_precatorio_sync_handler'
import type { TjspPrecatorioCommunicationCategory } from '#modules/integrations/services/tjsp_precatorio_communications_adapter'
import queueService from '#shared/services/queue_service'

const CATEGORIES = new Set<TjspPrecatorioCommunicationCategory>([
  'state_entities',
  'municipal_entities',
  'inss',
  'statistics',
])

export default class TjspSyncPrecatorios extends BaseCommand {
  static commandName = 'tjsp:sync-precatorios'
  static description =
    'Discover, download, extract, and import TJSP public precatorio communications'
  static options = {
    startApp: true,
  }

  @flags.string({
    description: 'Tenant id that will own the synchronized TJSP records',
  })
  declare tenantId?: string

  @flags.string({
    description:
      'Comma-separated TJSP categories: state_entities, municipal_entities, inss, statistics',
  })
  declare categories?: string

  @flags.number({
    description: 'Maximum communication detail pages to process',
  })
  declare limit?: number

  @flags.boolean({
    description: 'Discover and persist communications/documents without importing extracted rows',
  })
  declare skipImport: boolean

  @flags.boolean({
    description: 'Only discover communication links without downloading detail pages or documents',
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

    const payload: TjspPrecatorioSyncPayload = {
      tenantId: this.tenantId,
      categories: parseCategories(this.categories),
      limit: this.limit,
      downloadDetails: !this.dryRun,
      downloadDocuments: !this.dryRun,
      importDocuments: !this.dryRun && !this.skipImport,
      origin: 'manual_retry',
    }

    if (this.runInline || this.dryRun) {
      const result = await handleTjspPrecatorioSync(payload)
      this.logger.info(`TJSP precatorio sync completed inline: ${JSON.stringify(result)}`)
      return
    }

    const job = await queueService.add(
      TJSP_PRECATORIO_SYNC_QUEUE,
      'tjsp-precatorio-sync',
      payload,
      {
        jobId: `tjsp-precatorio-sync-${this.tenantId}-${DateTime.utc().toMillis()}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    )

    this.logger.info(
      `TJSP precatorio sync enqueued: ${JSON.stringify({
        tenantId: this.tenantId,
        jobId: job.id,
      })}`
    )

    await queueService.shutdown()
  }
}

function parseCategories(value?: string) {
  if (!value?.trim()) {
    return undefined
  }

  return value
    .split(',')
    .map((category) => category.trim())
    .filter((category): category is TjspPrecatorioCommunicationCategory =>
      CATEGORIES.has(category as TjspPrecatorioCommunicationCategory)
    )
}
