import { BaseCommand, flags } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'
import queueService from '#shared/services/queue_service'
import { queueNames } from '#start/jobs'

const INSPECTED_STATES = ['waiting', 'delayed', 'failed'] as const

export default class QueuePruneOrphans extends BaseCommand {
  static commandName = 'queue:prune-orphans'
  static description = 'Report or remove BullMQ jobs that reference deleted tenants'
  static options = {
    startApp: true,
  }

  @flags.boolean({
    description: 'Remove orphaned jobs instead of only reporting them',
  })
  declare apply: boolean

  async run() {
    const report: OrphanJobReport[] = []

    for (const queueName of queueNames) {
      const queue = queueService.getQueue(queueName)
      const jobs = await queue.getJobs([...INSPECTED_STATES], 0, 500, true)

      for (const job of jobs) {
        const tenantId = tenantIdFromPayload(job.data)
        if (!tenantId) {
          continue
        }

        if (await tenantExists(tenantId)) {
          continue
        }

        report.push({
          queueName,
          jobId: job.id ? String(job.id) : null,
          jobName: job.name,
          tenantId,
          state: await job.getState(),
        })

        if (this.apply) {
          await job.remove()
        }
      }
    }

    this.logger.info(
      `Orphan queue jobs: ${JSON.stringify({
        mode: this.apply ? 'apply' : 'dry_run',
        inspectedStates: INSPECTED_STATES,
        count: report.length,
        jobs: report,
      })}`
    )
    await queueService.shutdown()
  }
}

type OrphanJobReport = {
  queueName: string
  jobId: string | null
  jobName: string
  tenantId: string
  state: string
}

function tenantIdFromPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const tenantId = (payload as { tenantId?: unknown }).tenantId
  return typeof tenantId === 'string' && tenantId.trim() !== '' ? tenantId : null
}

async function tenantExists(tenantId: string) {
  const [row] = await db.from('tenants').where('id', tenantId).count('* as total')
  return Number(row.total) > 0
}
