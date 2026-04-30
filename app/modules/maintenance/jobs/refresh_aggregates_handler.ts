import db from '@adonisjs/lucid/services/db'
import jobRunService from '#shared/services/job_run_service'

export const REFRESH_AGGREGATES_QUEUE = 'maintenance-refresh-aggregates'

const MATERIALIZED_VIEWS = [
  'dashboard_asset_metrics',
  'debtor_aggregates',
  'asset_yearly_stats',
] as const

export type RefreshAggregatesPayload = {
  bullmqJobId?: string | null
  attempts?: number | null
  origin?: 'scheduler' | 'manual_retry' | 'system'
}

export async function handleRefreshAggregates(payload: RefreshAggregatesPayload = {}) {
  const run = await jobRunService.start({
    tenantId: null,
    jobName: 'maintenance-refresh-aggregates',
    queueName: REFRESH_AGGREGATES_QUEUE,
    bullmqJobId: payload.bullmqJobId ?? null,
    attempts: payload.attempts ?? null,
    origin: payload.origin ?? 'scheduler',
    metadata: {
      views: [...MATERIALIZED_VIEWS],
    },
  })

  try {
    const refreshedViews: string[] = []

    for (const view of MATERIALIZED_VIEWS) {
      await refreshMaterializedView(view)
      refreshedViews.push(view)
    }

    const metrics = { refreshedViews }
    await jobRunService.finish(run.id, 'completed', metrics)

    return metrics
  } catch (error) {
    await jobRunService.finish(run.id, 'failed', null, error)
    throw error
  }
}

async function refreshMaterializedView(viewName: string) {
  try {
    await db.rawQuery(`refresh materialized view concurrently ${viewName}`)
  } catch (error) {
    if (!isUnpopulatedMaterializedViewError(error)) {
      throw error
    }

    await db.rawQuery(`refresh materialized view ${viewName}`)
  }
}

function isUnpopulatedMaterializedViewError(error: unknown) {
  return error instanceof Error && error.message.includes('CONCURRENTLY cannot be used')
}
