import { BaseCommand } from '@adonisjs/core/ace'
import queueService from '#shared/services/queue_service'
import workerHeartbeatService from '#shared/services/worker_heartbeat_service'
import { queueNames } from '#start/jobs'

export default class QueueStatus extends BaseCommand {
  static commandName = 'queue:status'
  static description = 'Display BullMQ queue counts for operational queues'
  static options = {
    startApp: true,
  }

  async run() {
    const [snapshots, workers] = await Promise.all([
      queueService.getSnapshots(queueNames),
      workerHeartbeatService.queueFreshness(queueNames),
    ])
    const workerByQueue = new Map(workers.map((worker) => [worker.queueName, worker]))
    const rows = snapshots.map((snapshot) => {
      const worker = workerByQueue.get(snapshot.name)
      const hasLocalWorker = snapshot.worker.registered
      const hasFreshHeartbeat = worker?.status === 'ok'

      return {
        queue: snapshot.name,
        waiting: snapshot.counts.waiting ?? 0,
        active: snapshot.counts.active ?? 0,
        delayed: snapshot.counts.delayed ?? 0,
        failed: snapshot.counts.failed ?? 0,
        completed: snapshot.counts.completed ?? 0,
        worker: hasLocalWorker || hasFreshHeartbeat ? 'registered' : 'not_registered',
        workerHeartbeatAgeMs: worker?.ageMs ?? null,
      }
    })

    for (const row of rows) {
      this.logger.info(`Queue status: ${JSON.stringify(row)}`)
    }

    await queueService.shutdown()
  }
}
