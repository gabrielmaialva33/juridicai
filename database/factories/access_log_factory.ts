import factory from '@adonisjs/lucid/factories'
import AccessLog from '#modules/pii/models/access_log'
import { TenantFactory } from '#database/factories/tenant_factory'

export const AccessLogFactory = factory
  .define(AccessLog, async ({ faker }) => {
    const tenant = await TenantFactory.create()

    return {
      tenantId: tenant.id,
      action: 'reveal_success',
      allowed: true,
      reason: faker.lorem.sentence(),
      metadata: {},
    }
  })
  .build()
