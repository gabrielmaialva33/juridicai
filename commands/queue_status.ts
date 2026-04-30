import { BaseCommand } from '@adonisjs/core/ace'
import queueService from '#shared/services/queue_service'
import { queueNames } from '#start/jobs'

export default class QueueStatus extends BaseCommand {
  static commandName = 'queue:status'
  static description = 'Display BullMQ queue counts for operational queues'
  static options = {
    startApp: true,
  }

  async run() {
    const snapshots = await queueService.getSnapshots(queueNames)
    const rows = snapshots.map((snapshot) => ({
      queue: snapshot.name,
      waiting: snapshot.counts.waiting ?? 0,
      active: snapshot.counts.active ?? 0,
      delayed: snapshot.counts.delayed ?? 0,
      failed: snapshot.counts.failed ?? 0,
      completed: snapshot.counts.completed ?? 0,
      worker: snapshot.worker.registered ? 'registered' : 'not_registered',
    }))

    for (const row of rows) {
      this.logger.info(`Queue status: ${JSON.stringify(row)}`)
    }

    await queueService.shutdown()
  }
}
