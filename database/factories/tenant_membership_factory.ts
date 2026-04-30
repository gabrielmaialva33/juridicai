import factory from '@adonisjs/lucid/factories'
import TenantMembership from '#modules/tenant/models/tenant_membership'
import { ensureTenantId, ensureUserId } from '#database/factories/factory_helpers'

export const TenantMembershipFactory = factory
  .define(TenantMembership, async () => {
    return {
      status: 'active' as const,
    }
  })
  .before('create', async (_, row) => {
    await ensureTenantId(row)
    await ensureUserId(row)
  })
  .build()
