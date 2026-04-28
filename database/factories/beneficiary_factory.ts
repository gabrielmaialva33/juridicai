import factory from '@adonisjs/lucid/factories'
import Beneficiary from '#modules/pii/models/beneficiary'
import { TenantFactory } from '#database/factories/tenant_factory'

export const BeneficiaryFactory = factory
  .define(Beneficiary, async ({ faker }) => {
    const tenant = await TenantFactory.create()

    return {
      tenantId: tenant.id,
      beneficiaryHash: faker.string.hexadecimal({ length: 64, prefix: '' }),
      status: 'bunker_available',
    }
  })
  .build()
