import factory from '@adonisjs/lucid/factories'
import AccessLog from '#modules/pii/models/access_log'
import { ensureTenantId } from '#database/factories/factory_helpers'

export const AccessLogFactory = factory
  .define(AccessLog, async ({ faker }) => {
    return {
      action: 'reveal_success' as const,
      allowed: true,
      reason: faker.lorem.sentence(),
      metadata: {},
    }
  })
  .before('create', async (_, row) => {
    await ensureTenantId(row)
  })
  .build()
