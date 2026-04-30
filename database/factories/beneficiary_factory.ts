import factory from '@adonisjs/lucid/factories'
import Beneficiary from '#modules/pii/models/beneficiary'
import { ensureTenantId } from '#database/factories/factory_helpers'

export const BeneficiaryFactory = factory
  .define(Beneficiary, async ({ faker }) => {
    return {
      beneficiaryHash: faker.string.hexadecimal({ length: 64, prefix: '' }),
      status: 'bunker_available' as const,
    }
  })
  .before('create', async (_, row) => {
    await ensureTenantId(row)
  })
  .build()
