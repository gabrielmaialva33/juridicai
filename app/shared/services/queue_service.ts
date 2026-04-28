import type { JobsOptions, Processor } from 'bullmq'
import { Queue, Worker } from 'bullmq'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'

class QueueService {
  #queues = new Map<string, Queue>()
  #workers = new Map<string, Worker>()

  getQueue(name: string) {
    let queue = this.#queues.get(name)

    if (!queue) {
      queue = new Queue(name, {
        connection: this.getConnection(),
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 500,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        },
      })
      this.#queues.set(name, queue)
    }

    return queue
  }

  add<T>(queueName: string, jobName: string, payload: T, options?: JobsOptions) {
    return this.getQueue(queueName).add(jobName, payload, options)
  }

  registerWorker<T>(queueName: string, processor: Processor<T>) {
    const worker = new Worker(queueName, processor, {
      connection: this.getConnection(),
    })

    worker.on('failed', (job, error) => {
      logger.error({ err: error, jobId: job?.id, queueName }, 'Queue job failed')
    })

    this.#workers.set(queueName, worker)
    return worker
  }

  async shutdown() {
    await Promise.all([...this.#workers.values()].map((worker) => worker.close()))
    await Promise.all([...this.#queues.values()].map((queue) => queue.close()))

    this.#workers.clear()
    this.#queues.clear()
  }

  private getConnection() {
    return {
      host: env.get('REDIS_HOST'),
      port: env.get('REDIS_PORT'),
      password: env.get('REDIS_PASSWORD')?.release() || undefined,
    }
  }
}

export default new QueueService()
