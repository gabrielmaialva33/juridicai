import RadarJobRun from '#modules/admin/models/radar_job_run'
import jobRetryService, { JobRetryError } from '#modules/admin/services/job_retry_service'
import queueService from '#shared/services/queue_service'
import tenantContext from '#shared/helpers/tenant_context'
import workerHeartbeatService from '#shared/services/worker_heartbeat_service'
import { queueNames } from '#start/jobs'
import type { HttpContext } from '@adonisjs/core/http'

export default class JobsController {
  async index({ inertia, request }: HttpContext) {
    const page = positiveInteger(request.input('page'), 1)
    const limit = Math.min(positiveInteger(request.input('limit'), 25), 100)
    const paginator = await RadarJobRun.query()
      .where('tenant_id', tenantContext.requireTenantId())
      .orderBy('created_at', 'desc')
      .paginate(page, limit)
    const queues = await queueService.getSnapshots(queueNames)
    const workers = await workerHeartbeatService.queueFreshness(queueNames)

    return inertia.render('admin/jobs', {
      runs: paginator.all().map((run) => run.serialize()) as any,
      meta: paginator.getMeta() as any,
      queues: queues as any,
      workers: workers as any,
    })
  }

  async retry({ params, requestId, response }: HttpContext) {
    const run = await RadarJobRun.query()
      .where('id', params.id)
      .where('tenant_id', tenantContext.requireTenantId())
      .firstOrFail()

    try {
      const retry = await jobRetryService.retry(run, requestId)

      return response.accepted({
        run: run.serialize(),
        retry,
      })
    } catch (error) {
      if (error instanceof JobRetryError) {
        const status = error.code === 'not_retriable' ? 409 : 422

        return response.status(status).send({
          code: error.code,
          message: error.message,
        })
      }

      throw error
    }
  }
}

function positiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}
