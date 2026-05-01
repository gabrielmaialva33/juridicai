import { DateTime } from 'luxon'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import {
  DATAJUD_NATIONAL_PRECATORIO_SYNC_QUEUE,
  handleDataJudNationalPrecatorioSync,
  type DataJudNationalPrecatorioSyncPayload,
} from '#modules/integrations/jobs/datajud_national_precatorio_sync_handler'
import queueService from '#shared/services/queue_service'
import { normalizeAliases } from '#modules/integrations/services/datajud_asset_enrichment_service'

export default class DataJudSyncPrecatorios extends BaseCommand {
  static commandName = 'datajud:sync-precatorios'
  static description = 'Discover precatorio and RPV processes across DataJud court aliases'
  static options = {
    startApp: true,
  }

  @flags.string({
    description: 'Tenant id that will own discovered DataJud process records',
  })
  declare tenantId?: string

  @flags.string({
    description: 'Comma-separated DataJud court aliases. Omit to scan all official aliases',
  })
  declare courts?: string

  @flags.number({
    description:
      'Page size per DataJud request. The API supports large pages, but use modest values',
  })
  declare pageSize?: number

  @flags.number({
    description: 'Maximum pages to read per court in this run',
  })
  declare maxPagesPerCourt?: number

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

    const payload: DataJudNationalPrecatorioSyncPayload = {
      tenantId: this.tenantId,
      courtAliases: normalizeAliases(this.courts?.split(',')),
      pageSize: this.pageSize,
      maxPagesPerCourt: this.maxPagesPerCourt,
      origin: 'manual_retry',
    }

    if (this.runInline) {
      const result = await handleDataJudNationalPrecatorioSync(payload)
      this.logger.info(
        `DataJud national precatorio sync completed inline: ${JSON.stringify(result)}`
      )
      return
    }

    const job = await queueService.add(
      DATAJUD_NATIONAL_PRECATORIO_SYNC_QUEUE,
      'datajud-national-precatorio-sync',
      payload,
      {
        jobId: `datajud-national-precatorio-sync-${this.tenantId}-${DateTime.utc().toMillis()}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    )

    this.logger.info(
      `DataJud national precatorio sync enqueued: ${JSON.stringify({
        tenantId: this.tenantId,
        jobId: job.id,
        courts: payload.courtAliases ?? 'all',
        pageSize: this.pageSize ?? null,
        maxPagesPerCourt: this.maxPagesPerCourt ?? null,
      })}`
    )

    await queueService.shutdown()
  }
}
