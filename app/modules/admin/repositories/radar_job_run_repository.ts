import BaseRepository from '#shared/repositories/base_repository'
import RadarJobRun from '#modules/admin/models/radar_job_run'

class RadarJobRunRepository extends BaseRepository<typeof RadarJobRun> {
  constructor() {
    super(RadarJobRun)
  }

  latestByBullJob(tenantId: string, input: { queueName: string; bullmqJobId: string }) {
    return this.query(tenantId)
      .where('queue_name', input.queueName)
      .where('bullmq_job_id', input.bullmqJobId)
      .orderBy('created_at', 'desc')
      .first()
  }

  paginateRecent(tenantId: string, page: number, limit: number) {
    return this.query(tenantId).orderBy('created_at', 'desc').paginate(page, limit)
  }

  latestRunByJob(tenantId: string) {
    return this.query(tenantId)
      .select('job_name')
      .max('created_at as last_created_at')
      .groupBy('job_name')
  }
}

export default new RadarJobRunRepository()
