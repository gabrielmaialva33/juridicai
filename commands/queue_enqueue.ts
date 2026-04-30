import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import queueService from '#shared/services/queue_service'
import {
  SIOP_RECONCILE_QUEUE,
  handleSiopReconcile,
} from '#modules/siop/jobs/siop_reconcile_handler'
import {
  APPLY_RETENTION_POLICY_QUEUE,
  handleApplyRetentionPolicy,
} from '#modules/maintenance/jobs/apply_retention_policy_handler'
import {
  PURGE_STAGING_QUEUE,
  handlePurgeStaging,
} from '#modules/maintenance/jobs/purge_staging_handler'
import {
  REFRESH_AGGREGATES_QUEUE,
  handleRefreshAggregates,
} from '#modules/maintenance/jobs/refresh_aggregates_handler'
import { VACUUM_HINT_QUEUE, handleVacuumHint } from '#modules/maintenance/jobs/vacuum_hint_handler'

const ENQUEUEABLE_JOBS = {
  [SIOP_RECONCILE_QUEUE]: {
    jobName: 'siop-reconcile',
    handler: () => handleSiopReconcile({ origin: 'manual_retry' }),
  },
  [PURGE_STAGING_QUEUE]: {
    jobName: 'maintenance-purge-staging',
    handler: () => handlePurgeStaging({ origin: 'manual_retry' }),
  },
  [APPLY_RETENTION_POLICY_QUEUE]: {
    jobName: 'maintenance-apply-retention-policy',
    handler: () => handleApplyRetentionPolicy({ origin: 'manual_retry' }),
  },
  [REFRESH_AGGREGATES_QUEUE]: {
    jobName: 'maintenance-refresh-aggregates',
    handler: () => handleRefreshAggregates({ origin: 'manual_retry' }),
  },
  [VACUUM_HINT_QUEUE]: {
    jobName: 'maintenance-vacuum-hint',
    handler: () => handleVacuumHint({ origin: 'manual_retry' }),
  },
} as const

type EnqueueableQueueName = keyof typeof ENQUEUEABLE_JOBS

export default class QueueEnqueue extends BaseCommand {
  static commandName = 'queue:enqueue'
  static description = 'Enqueue an operational backend job'
  static options = {
    startApp: true,
  }

  @args.string({
    description: `Queue name: ${Object.keys(ENQUEUEABLE_JOBS).join(', ')}`,
  })
  declare queueName: string

  @flags.boolean({
    description: 'Run the handler inline instead of adding a BullMQ job',
  })
  declare runInline: boolean

  async run() {
    if (!this.isKnownQueue(this.queueName)) {
      this.logger.error(`Unknown queue "${this.queueName}".`)
      this.logger.info(`Available queues: ${Object.keys(ENQUEUEABLE_JOBS).join(', ')}`)
      this.exitCode = 1
      return
    }

    const config = ENQUEUEABLE_JOBS[this.queueName]

    if (this.runInline) {
      const result = await config.handler()
      this.logger.info(
        `Job completed inline: ${JSON.stringify({ queueName: this.queueName, result })}`
      )
      return
    }

    const jobId = `${config.jobName}-${Date.now()}`
    const job = await queueService.add(
      this.queueName,
      config.jobName,
      { origin: 'manual_retry' },
      { jobId }
    )

    this.logger.info(
      `Job enqueued: ${JSON.stringify({ queueName: this.queueName, jobId: job.id })}`
    )
  }

  private isKnownQueue(queueName: string): queueName is EnqueueableQueueName {
    return queueName in ENQUEUEABLE_JOBS
  }
}
