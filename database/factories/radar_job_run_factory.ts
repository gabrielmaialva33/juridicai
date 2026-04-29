import factory from '@adonisjs/lucid/factories'
import RadarJobRun from '#modules/admin/models/radar_job_run'
import { DateTime } from 'luxon'

export const RadarJobRunFactory = factory
  .define(RadarJobRun, async ({ faker }) => {
    return {
      jobName: `job:${faker.string.uuid()}`,
      queueName: 'default',
      status: 'pending' as const,
      origin: 'system' as const,
      attempts: 0,
      metadata: {},
      metrics: {},
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    }
  })
  .build()
