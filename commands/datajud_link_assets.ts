import { DateTime } from 'luxon'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import {
  DATAJUD_PROCESS_ASSET_LINK_QUEUE,
  handleDataJudProcessAssetLink,
  type DataJudProcessAssetLinkPayload,
} from '#modules/integrations/jobs/datajud_process_asset_link_handler'
import queueService from '#shared/services/queue_service'

export default class DataJudLinkAssets extends BaseCommand {
  static commandName = 'datajud:link-assets'
  static description = 'Link normalized DataJud processes to precatorio assets by exact CNJ number'
  static options = {
    startApp: true,
  }

  @flags.string({
    description: 'Tenant id that owns the DataJud processes and assets',
  })
  declare tenantId?: string

  @flags.number({
    description: 'Maximum unlinked DataJud processes to inspect',
  })
  declare limit?: number

  @flags.boolean({
    description: 'Do not project existing process signals into asset_events',
  })
  declare noProjectSignals: boolean

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

    const payload: DataJudProcessAssetLinkPayload = {
      tenantId: this.tenantId,
      limit: this.limit,
      projectSignals: !this.noProjectSignals,
      origin: 'manual_retry',
    }

    if (this.runInline) {
      const result = await handleDataJudProcessAssetLink(payload)
      this.logger.info(`DataJud process asset link completed inline: ${JSON.stringify(result)}`)
      return
    }

    const job = await queueService.add(
      DATAJUD_PROCESS_ASSET_LINK_QUEUE,
      'datajud-process-asset-link',
      payload,
      {
        jobId: `datajud-process-asset-link-${this.tenantId}-${DateTime.utc().toMillis()}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    )

    this.logger.info(
      `DataJud process asset link enqueued: ${JSON.stringify({
        tenantId: this.tenantId,
        jobId: job.id,
      })}`
    )

    await queueService.shutdown()
  }
}
