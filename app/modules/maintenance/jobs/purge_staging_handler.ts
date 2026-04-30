import db from '@adonisjs/lucid/services/db'
import jobRunService from '#shared/services/job_run_service'

export const PURGE_STAGING_QUEUE = 'maintenance-purge-staging'

export type PurgeStagingPayload = {
  olderThanDays?: number
  bullmqJobId?: string | null
  attempts?: number | null
  origin?: 'scheduler' | 'manual_retry' | 'system'
}

export async function handlePurgeStaging(payload: PurgeStagingPayload = {}) {
  const run = await jobRunService.start({
    tenantId: null,
    jobName: 'maintenance-purge-staging',
    queueName: PURGE_STAGING_QUEUE,
    bullmqJobId: payload.bullmqJobId ?? null,
    attempts: payload.attempts ?? null,
    origin: payload.origin ?? 'scheduler',
    metadata: {
      olderThanDays: payload.olderThanDays ?? 90,
    },
  })

  try {
    const olderThanDays = Math.max(1, payload.olderThanDays ?? 90)
    const deletedRows = await db
      .from('siop_staging_rows')
      .whereRaw(`processed_at < now() - (? * interval '1 day')`, [olderThanDays])
      .delete()

    const metrics = { deletedRows }
    await jobRunService.finish(run.id, 'completed', metrics)

    return metrics
  } catch (error) {
    await jobRunService.finish(run.id, 'failed', null, error)
    throw error
  }
}
