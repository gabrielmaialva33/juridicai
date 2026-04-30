import db from '@adonisjs/lucid/services/db'
import jobRunService from '#shared/services/job_run_service'

export const SIOP_RECONCILE_QUEUE = 'siop-reconcile'

export type SiopReconcilePayload = {
  staleAfterMinutes?: number
  bullmqJobId?: string | null
  attempts?: number | null
  origin?: 'scheduler' | 'manual_retry' | 'system'
}

export async function handleSiopReconcile(payload: SiopReconcilePayload = {}) {
  const staleAfterMinutes = Math.max(5, payload.staleAfterMinutes ?? 120)
  const run = await jobRunService.start({
    tenantId: null,
    jobName: 'siop-reconcile',
    queueName: SIOP_RECONCILE_QUEUE,
    bullmqJobId: payload.bullmqJobId ?? null,
    attempts: payload.attempts ?? null,
    origin: payload.origin ?? 'scheduler',
    metadata: { staleAfterMinutes },
  })

  try {
    const staleImports = await db
      .from('siop_imports')
      .whereIn('status', ['pending', 'running'])
      .whereRaw(`updated_at < now() - (? * interval '1 minute')`, [staleAfterMinutes])
      .update({
        status: 'failed',
        finished_at: new Date(),
        updated_at: new Date(),
      })

    const rows = await db
      .from('siop_imports')
      .select('status')
      .count('* as total')
      .groupBy('status')
      .orderBy('status', 'asc')

    const statusCounts = Object.fromEntries(
      rows.map((row) => [String(row.status), Number(row.total)])
    )
    const metrics = {
      staleImports,
      statusCounts,
    }

    await jobRunService.finish(run.id, 'completed', metrics)

    return metrics
  } catch (error) {
    await jobRunService.finish(run.id, 'failed', null, error)
    throw error
  }
}
