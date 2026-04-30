import factory from '@adonisjs/lucid/factories'
import Debtor from '#modules/debtors/models/debtor'
import { ensureTenantId } from '#database/factories/factory_helpers'

export const DebtorFactory = factory
  .define(Debtor, async ({ faker }) => {
    const name = faker.company.name()
    const normalizedName = name.toUpperCase()

    return {
      name,
      normalizedName,
      normalizedKey: `${faker.helpers.slugify(normalizedName)}-${faker.string.uuid()}`,
      debtorType: 'union' as const,
      paymentRegime: 'federal_unique' as const,
      cnpj: faker.string.numeric(14),
      stateCode: 'DF',
    }
  })
  .before('create', async (_, row) => {
    await ensureTenantId(row)
  })
  .build()
