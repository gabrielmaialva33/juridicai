import factory from '@adonisjs/lucid/factories'
import WorkerHeartbeat from '#modules/admin/models/worker_heartbeat'
import { DateTime } from 'luxon'

export const WorkerHeartbeatFactory = factory
  .define(WorkerHeartbeat, async ({ faker }) => {
    return {
      workerId: faker.string.uuid(),
      queueName: 'default',
      hostname: faker.internet.domainName(),
      pid: faker.number.int({ min: 1, max: 99_999 }),
      metadata: {},
      checkedAt: DateTime.now(),
    }
  })
  .build()
