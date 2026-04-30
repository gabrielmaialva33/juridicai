import RadarJobRun from '#modules/admin/models/radar_job_run'
import queueService from '#shared/services/queue_service'
import tenantContext from '#shared/helpers/tenant_context'
import workerHeartbeatService from '#shared/services/worker_heartbeat_service'
import { queueNames } from '#start/jobs'
import type { HttpContext } from '@adonisjs/core/http'

export default class JobsController {
  async index({ response }: HttpContext) {
    const runs = await RadarJobRun.query()
      .where('tenant_id', tenantContext.requireTenantId())
      .orderBy('created_at', 'desc')
      .limit(25)
    const queues = await queueService.getSnapshots(queueNames)
    const workers = await workerHeartbeatService.queueFreshness(queueNames)

    return response.ok({
      runs: runs.map((run) => run.serialize()),
      queues,
      workers,
    })
  }
}
