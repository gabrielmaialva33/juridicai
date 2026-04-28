import db from '@adonisjs/lucid/services/db'

type StartJobRunPayload = {
  tenantId?: string | null
  jobName: string
  queueName?: string | null
  bullmqJobId?: string | null
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
        metadata: payload.metadata ?? null,
        status: 'running',
        started_at: new Date(),
      })
      .returning('*')

    return row
  }

  finish(id: string, status: 'succeeded' | 'failed', metrics?: Record<string, unknown>) {
    return db
      .from('radar_job_runs')
      .where('id', id)
      .update({
        status,
        metrics: metrics ?? null,
        finished_at: new Date(),
      })
  }
}

export default new JobRunService()
