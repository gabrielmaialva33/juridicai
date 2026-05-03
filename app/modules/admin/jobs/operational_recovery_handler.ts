import { DateTime } from 'luxon'
import operationalRecoveryService from '#modules/admin/services/operational_recovery_service'
import jobRunService from '#shared/services/job_run_service'
import type { JobRunOrigin } from '#shared/types/model_enums'

export const OPERATIONAL_RECOVERY_QUEUE = 'admin-operational-recovery'

export type OperationalRecoveryPayload = {
  tenantIds?: string[] | null
  dryRun?: boolean
  now?: string | null
  bullmqJobId?: string | null
  attempts?: number | null
  origin?: JobRunOrigin
}

export async function handleOperationalRecovery(payload: OperationalRecoveryPayload = {}) {
  const run = await jobRunService.start({
    tenantId: null,
    jobName: 'admin-operational-recovery',
    queueName: OPERATIONAL_RECOVERY_QUEUE,
    bullmqJobId: payload.bullmqJobId ?? null,
    attempts: payload.attempts ?? null,
    origin: payload.origin ?? 'scheduler',
    metadata: {
      tenantIds: payload.tenantIds ?? null,
      dryRun: payload.dryRun ?? false,
      now: payload.now ?? null,
    },
  })

  try {
    const metrics = await operationalRecoveryService.run({
      tenantIds: payload.tenantIds,
      dryRun: payload.dryRun ?? false,
      now: payload.now ? DateTime.fromISO(payload.now, { zone: 'utc' }) : undefined,
    })

    await jobRunService.finish(run.id, 'completed', metrics)

    return metrics
  } catch (error) {
    await jobRunService.finish(run.id, 'failed', null, error)
    throw error
  }
}
