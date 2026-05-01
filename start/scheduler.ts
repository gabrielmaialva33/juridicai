import scheduler from 'adonisjs-scheduler/services/main'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import queueService from '#shared/services/queue_service'
import governmentDataSyncScheduleService from '#modules/integrations/services/government_data_sync_schedule_service'
import { SIOP_RECONCILE_QUEUE } from '#modules/siop/jobs/siop_reconcile_handler'
import { GOVERNMENT_DATA_SYNC_ORCHESTRATOR_QUEUE } from '#modules/integrations/jobs/government_data_sync_orchestrator_handler'
import { APPLY_RETENTION_POLICY_QUEUE } from '#modules/maintenance/jobs/apply_retention_policy_handler'
import { PURGE_STAGING_QUEUE } from '#modules/maintenance/jobs/purge_staging_handler'
import { REFRESH_AGGREGATES_QUEUE } from '#modules/maintenance/jobs/refresh_aggregates_handler'
import { VACUUM_HINT_QUEUE } from '#modules/maintenance/jobs/vacuum_hint_handler'

scheduler
  .call(() => enqueueScheduledJob(REFRESH_AGGREGATES_QUEUE, 'maintenance-refresh-aggregates'))
  .everyFifteenMinutes()
  .withoutOverlapping()

scheduler
  .call(() => enqueueScheduledJob(SIOP_RECONCILE_QUEUE, 'siop-reconcile'))
  .weeklyOn(0, '03:00')
  .withoutOverlapping()

scheduler
  .call(() =>
    enqueueScheduledTenantJobs(
      GOVERNMENT_DATA_SYNC_ORCHESTRATOR_QUEUE,
      'government-data-sync-orchestrator',
      governmentDataSyncScheduleService.buildScheduledPayload()
    )
  )
  .dailyAt('00:30')
  .withoutOverlapping()

scheduler
  .call(() => enqueueScheduledJob(PURGE_STAGING_QUEUE, 'maintenance-purge-staging'))
  .weeklyOn(0, '03:30')
  .withoutOverlapping()

scheduler
  .call(() =>
    enqueueScheduledJob(APPLY_RETENTION_POLICY_QUEUE, 'maintenance-apply-retention-policy')
  )
  .monthlyOn(1, '04:00')
  .withoutOverlapping()

scheduler
  .call(() => enqueueScheduledJob(VACUUM_HINT_QUEUE, 'maintenance-vacuum-hint'))
  .dailyAt('02:00')
  .withoutOverlapping()

async function enqueueScheduledJob(queueName: string, jobName: string) {
  const windowId = Math.floor(DateTime.utc().toMillis() / (15 * 60 * 1000))
  const jobId = `${jobName}-${windowId}`

  await queueService.add(
    queueName,
    jobName,
    {
      origin: 'scheduler',
    },
    {
      jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    }
  )
}

async function enqueueScheduledTenantJobs(
  queueName: string,
  jobName: string,
  payload: Record<string, unknown>
) {
  const tenants = await activeTenantIds()
  const windowId = DateTime.utc().toFormat('yyyy-LL-dd')

  await Promise.all(
    tenants.map((tenantId) =>
      queueService.add(
        queueName,
        jobName,
        {
          ...payload,
          tenantId,
          origin: 'scheduler',
        },
        {
          jobId: `${jobName}-${tenantId}-${windowId}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        }
      )
    )
  )
}

async function activeTenantIds() {
  const rows = await db.from('tenants').where('status', 'active').select('id')

  return rows.map((row) => String(row.id))
}
