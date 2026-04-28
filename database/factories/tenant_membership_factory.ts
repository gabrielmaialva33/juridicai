import factory from '@adonisjs/lucid/factories'
import TenantMembership from '#modules/tenant/models/tenant_membership'
import { TenantFactory } from '#database/factories/tenant_factory'
import { UserFactory } from '#database/factories/user_factory'

export const TenantMembershipFactory = factory
  .define(TenantMembership, async () => {
    const tenant = await TenantFactory.create()
    const user = await UserFactory.create()

    return {
      tenantId: tenant.id,
      userId: user.id,
      status: 'active',
    }
  })
  .build()
