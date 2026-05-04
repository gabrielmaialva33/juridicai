import { BaseCommand, flags } from '@adonisjs/core/ace'
import queueService from '#shared/services/queue_service'
import { queueNames } from '#start/jobs'

const DEFAULT_STATES = ['waiting', 'delayed'] as const
const queueNameSet = new Set<string>(queueNames)

export default class QueuePruneDuplicates extends BaseCommand {
  static commandName = 'queue:prune-duplicates'
  static description = 'Report or remove duplicate BullMQ jobs by queue, name, and payload'
  static options = {
    startApp: true,
  }

  @flags.boolean({
    description: 'Remove duplicate jobs instead of only reporting them',
  })
  declare apply: boolean

  @flags.string({
    description: 'Comma-separated queue names. Defaults to all operational queues',
  })
  declare queues?: string

  @flags.number({
    description: 'Maximum jobs to inspect per queue',
  })
  declare limit?: number

  async run() {
    const inspectedQueues = selectedQueues(this.queues)
    const limit = normalizeLimit(this.limit)
    const report: DuplicateJobReport[] = []

    for (const queueName of inspectedQueues) {
      const queue = queueService.getQueue(queueName)
      const jobs = await queue.getJobs([...DEFAULT_STATES], 0, limit - 1, true)
      const seen = new Set<string>()

      for (const job of jobs) {
        const signature = jobSignature(job.name, job.data)

        if (!seen.has(signature)) {
          seen.add(signature)
          continue
        }

        const duplicate = {
          queueName,
          jobId: job.id ? String(job.id) : null,
          jobName: job.name,
          state: await job.getState(),
          signature,
        }
        report.push(duplicate)

        if (this.apply) {
          await job.remove()
        }
      }
    }

    this.logger.info(
      `Duplicate queue jobs: ${JSON.stringify({
        mode: this.apply ? 'apply' : 'dry_run',
        inspectedStates: DEFAULT_STATES,
        inspectedQueues,
        inspectedLimit: limit,
        count: report.length,
        jobs: report,
      })}`
    )
    await queueService.shutdown()
  }
}

type DuplicateJobReport = {
  queueName: string
  jobId: string | null
  jobName: string
  state: string
  signature: string
}

function selectedQueues(value?: string) {
  const requested = (value ?? '')
    .split(',')
    .map((queue) => queue.trim())
    .filter(Boolean)

  if (requested.length === 0) {
    return queueNames
  }

  return requested.filter((queue) => queueNameSet.has(queue))
}

function normalizeLimit(value: number | undefined) {
  if (!value || value < 1) {
    return 500
  }

  return Math.min(Math.trunc(value), 5_000)
}

function jobSignature(jobName: string, payload: unknown) {
  return `${jobName}:${stableStringify(payload)}`
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>
    const keys = Object.keys(object).sort()

    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(',')}}`
  }

  return JSON.stringify(value)
}
