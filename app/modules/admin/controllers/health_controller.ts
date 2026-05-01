import db from '@adonisjs/lucid/services/db'
import queueService from '#shared/services/queue_service'
import workerHeartbeatService from '#shared/services/worker_heartbeat_service'
import { queueNames } from '#start/jobs'
import type { HttpContext } from '@adonisjs/core/http'

export default class HealthController {
  async index({ inertia, request, response }: HttpContext) {
    const checks = {
      database: await this.checkDatabase(),
      queues: await this.checkQueues(),
      workers: await workerHeartbeatService.queueFreshness(queueNames),
    }
    const status =
      checks.database.status === 'ok' && checks.queues.status === 'ok' ? 'ok' : 'degraded'

    if (request.accepts(['html']) === 'html' || request.header('x-inertia')) {
      return inertia.render('admin/health', {
        status,
        checks: checks as any,
      })
    }
    return response.status(status === 'ok' ? 200 : 503).send({
      status,
      checks,
    })
  }

  private async checkDatabase() {
    try {
      await db.rawQuery('select 1')
      return { status: 'ok' as const }
    } catch (error) {
      return {
        status: 'failed' as const,
        message: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async checkQueues() {
    try {
      return {
        status: 'ok' as const,
        snapshots: await queueService.getSnapshots(queueNames),
      }
    } catch (error) {
      return {
        status: 'failed' as const,
        message: error instanceof Error ? error.message : String(error),
      }
    }
  }
}
