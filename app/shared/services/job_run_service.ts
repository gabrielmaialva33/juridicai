import db from '@adonisjs/lucid/services/db'

type StartJobRunPayload = {
  tenantId?: string | null
  jobName: string
  queueName?: string | null
  bullmqJobId?: string | null
  attempts?: number | null
  metadata?: Record<string, unknown> | null
}

class JobRunService {
  async start(payload: StartJobRunPayload) {
    const [row] = await db
      .table('radar_job_runs')
      .insert({
        tenant_id: payload.tenantId ?? null,
        job_name: payload.jobName,
        queue_name: payload.queueName ?? null,
        bullmq_job_id: payload.bullmqJobId ?? null,
        attempts: payload.attempts ?? 0,
        metadata: payload.metadata ?? null,
        status: 'running',
        started_at: new Date(),
      })
      .returning('*')

    return row
  }

  finish(
    id: string,
    status: 'completed' | 'failed',
    metrics?: Record<string, unknown> | null,
    error?: unknown
  ) {
    const finishedAt = new Date()
    const errorPayload = this.serializeError(error)

    return db
      .from('radar_job_runs')
      .where('id', id)
      .update({
        status,
        metrics: metrics ?? null,
        error_code: errorPayload.code,
        error_message: errorPayload.message,
        finished_at: finishedAt,
        duration_ms: db.raw('extract(epoch from (?::timestamptz - started_at)) * 1000', [
          finishedAt.toISOString(),
        ]),
      })
  }

  private serializeError(error: unknown) {
    if (!error) {
      return {
        code: null,
        message: null,
      }
    }

    if (error instanceof Error) {
      return {
        code: error.name,
        message: error.message,
      }
    }

    return {
      code: 'E_JOB_FAILED',
      message: String(error),
    }
  }
}

export default new JobRunService()
