import db from '@adonisjs/lucid/services/db'
import jobRunService from '#shared/services/job_run_service'

export const VACUUM_HINT_QUEUE = 'maintenance-vacuum-hint'

const ANALYZE_TARGETS = [
  'precatorio_assets',
  'asset_events',
  'asset_scores',
  'siop_imports',
  'siop_staging_rows',
  'debtors',
] as const

export type VacuumHintPayload = {
  bullmqJobId?: string | null
  attempts?: number | null
  origin?: 'scheduler' | 'manual_retry' | 'system'
}

export async function handleVacuumHint(payload: VacuumHintPayload = {}) {
  const run = await jobRunService.start({
    tenantId: null,
    jobName: 'maintenance-vacuum-hint',
    queueName: VACUUM_HINT_QUEUE,
    bullmqJobId: payload.bullmqJobId ?? null,
    attempts: payload.attempts ?? null,
    origin: payload.origin ?? 'scheduler',
    metadata: {
      targets: [...ANALYZE_TARGETS],
    },
  })

  try {
    for (const tableName of ANALYZE_TARGETS) {
      await db.rawQuery(`analyze ${tableName}`)
    }

    const metrics = { analyzedTables: [...ANALYZE_TARGETS] }
    await jobRunService.finish(run.id, 'completed', metrics)

    return metrics
  } catch (error) {
    await jobRunService.finish(run.id, 'failed', null, error)
    throw error
  }
}
