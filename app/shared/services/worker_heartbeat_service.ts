import os from 'node:os'
import db from '@adonisjs/lucid/services/db'

type HeartbeatPayload = {
  workerId: string
  queueName: string
  metadata?: Record<string, unknown> | null
}

class WorkerHeartbeatService {
  async beat(payload: HeartbeatPayload) {
    await db.table('worker_heartbeats').insert({
      worker_id: payload.workerId,
      queue_name: payload.queueName,
      hostname: os.hostname(),
      pid: process.pid,
      metadata: payload.metadata ?? null,
      checked_at: new Date(),
    })
  }

  listRecent(limit = 25) {
    return db.from('worker_heartbeats').select('*').orderBy('checked_at', 'desc').limit(limit)
  }

  async queueFreshness(queueNames: string[], staleAfterSeconds = 60) {
    const rows = await db
      .from('worker_heartbeats')
      .select('queue_name')
      .max('checked_at as checked_at')
      .whereIn('queue_name', queueNames)
      .groupBy('queue_name')

    const byQueue = new Map(rows.map((row) => [String(row.queue_name), row.checked_at as Date]))
    const now = Date.now()

    return queueNames.map((queueName) => {
      const checkedAt = byQueue.get(queueName)
      const ageMs = checkedAt ? now - new Date(checkedAt).getTime() : null

      return {
        queueName,
        checkedAt,
        status: ageMs !== null && ageMs <= staleAfterSeconds * 1000 ? 'ok' : 'stale',
        ageMs,
      }
    })
  }
}

export default new WorkerHeartbeatService()
