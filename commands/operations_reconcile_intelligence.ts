import { BaseCommand, flags } from '@adonisjs/core/ace'
import { DateTime } from 'luxon'
import queueService from '#shared/services/queue_service'
import {
  ASSET_INTELLIGENCE_RECONCILE_QUEUE,
  type AssetIntelligenceReconcilePayload,
  handleAssetIntelligenceReconcile,
} from '#modules/operations/jobs/asset_intelligence_reconcile_handler'
import type { SourceType } from '#shared/types/model_enums'

export default class OperationsReconcileIntelligence extends BaseCommand {
  static commandName = 'operations:reconcile-intelligence'
  static description =
    'Enqueue or run asset intelligence reconciliation for incomplete precatorio assets'
  static options = {
    startApp: true,
  }

  @flags.string({
    description: 'Tenant id that owns the assets to reconcile',
  })
  declare tenantId?: string

  @flags.number({
    description: 'Maximum number of candidate assets to inspect',
  })
  declare limit?: number

  @flags.string({
    description: 'Optional asset source filter, for example "siop" or "tribunal"',
  })
  declare source?: SourceType

  @flags.number({
    description: 'Maximum actions to run per asset',
  })
  declare maxActionsPerAsset?: number

  @flags.number({
    description: 'Cooldown in hours before an asset may be reconciled again',
  })
  declare recentActionCooldownHours?: number

  @flags.boolean({
    description: 'Only execute high-priority recommended actions',
  })
  declare highPriorityOnly: boolean

  @flags.boolean({
    description: 'Skip manual-only actions such as high-severity conflict review',
  })
  declare skipManualActions: boolean

  @flags.boolean({
    description: 'Allow automated actions even when high-severity conflicts exist',
  })
  declare allowAutomationWithConflicts: boolean

  @flags.boolean({
    description: 'Disable national data coherence prioritization for this run',
  })
  declare skipNationalCoherence: boolean

  @flags.boolean({
    description: 'Skip materializing per-field canonical evidence rows',
  })
  declare skipFieldEvidence: boolean

  @flags.boolean({
    description: 'Run inline instead of enqueueing a BullMQ job',
  })
  declare runInline: boolean

  @flags.boolean({
    description: 'Plan actions without enqueueing or mutating operational outputs',
  })
  declare dryRun: boolean

  async run() {
    if (!this.tenantId) {
      this.logger.error('--tenant-id is required.')
      this.exitCode = 1
      return
    }

    const payload: AssetIntelligenceReconcilePayload = {
      tenantId: this.tenantId,
      limit: this.limit,
      source: this.source,
      dryRun: this.dryRun,
      highPriorityOnly: this.highPriorityOnly,
      includeManualActions: !this.skipManualActions,
      allowAutomationWithConflicts: this.allowAutomationWithConflicts,
      maxActionsPerAsset: this.maxActionsPerAsset,
      recentActionCooldownHours: this.recentActionCooldownHours,
      useNationalCoherence: !this.skipNationalCoherence,
      materializeFieldEvidence: !this.skipFieldEvidence,
      requestId: `operations-reconcile-intelligence-${DateTime.utc().toMillis()}`,
      origin: 'manual_retry',
    }

    if (this.runInline || this.dryRun) {
      const metrics = await handleAssetIntelligenceReconcile(payload)
      this.logger.info(
        `Asset intelligence reconciliation completed inline: ${JSON.stringify(metrics)}`
      )
      return
    }

    const job = await queueService.add(
      ASSET_INTELLIGENCE_RECONCILE_QUEUE,
      'asset-intelligence-reconcile',
      payload,
      {
        jobId: `asset-intelligence-reconcile-${this.tenantId}-${DateTime.utc().toMillis()}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    )

    this.logger.info(
      `Asset intelligence reconciliation enqueued: ${JSON.stringify({
        tenantId: this.tenantId,
        jobId: job.id,
        limit: this.limit ?? null,
        source: this.source ?? null,
        dryRun: this.dryRun,
      })}`
    )

    await queueService.shutdown()
  }
}
