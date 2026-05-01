import { DateTime } from 'luxon'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import {
  DATAJUD_LEGAL_SIGNAL_CLASSIFIER_QUEUE,
  handleDataJudLegalSignalClassifier,
  type DataJudLegalSignalClassifierPayload,
} from '#modules/integrations/jobs/datajud_legal_signal_classifier_handler'
import queueService from '#shared/services/queue_service'

export default class DataJudClassifySignals extends BaseCommand {
  static commandName = 'datajud:classify-signals'
  static description = 'Classify legal signals from normalized DataJud movements'
  static options = {
    startApp: true,
  }

  @flags.string({
    description: 'Tenant id that owns the DataJud movements',
  })
  declare tenantId?: string

  @flags.number({
    description: 'Maximum movements to classify',
  })
  declare limit?: number

  @flags.string({
    description: 'Optional judicial process id to classify',
  })
  declare processId?: string

  @flags.boolean({
    description: 'Do not project process signals into asset_events',
  })
  declare noAssetEvents: boolean

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

    const payload: DataJudLegalSignalClassifierPayload = {
      tenantId: this.tenantId,
      limit: this.limit,
      processId: this.processId,
      projectAssetEvents: !this.noAssetEvents,
      origin: 'manual_retry',
    }

    if (this.runInline) {
      const result = await handleDataJudLegalSignalClassifier(payload)
      this.logger.info(
        `DataJud legal signal classification completed inline: ${JSON.stringify(result)}`
      )
      return
    }

    const job = await queueService.add(
      DATAJUD_LEGAL_SIGNAL_CLASSIFIER_QUEUE,
      'datajud-legal-signal-classifier',
      payload,
      {
        jobId: `datajud-legal-signal-classifier-${this.tenantId}-${DateTime.utc().toMillis()}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    )

    this.logger.info(
      `DataJud legal signal classification enqueued: ${JSON.stringify({
        tenantId: this.tenantId,
        jobId: job.id,
      })}`
    )

    await queueService.shutdown()
  }
}
