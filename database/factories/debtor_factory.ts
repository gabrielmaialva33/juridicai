import factory from '@adonisjs/lucid/factories'
import Debtor from '#modules/debtors/models/debtor'
import { TenantFactory } from '#database/factories/tenant_factory'

export const DebtorFactory = factory
  .define(Debtor, async ({ faker }) => {
    const tenant = await TenantFactory.create()
    const name = faker.company.name()
    const normalizedName = name.toUpperCase()

    return {
      tenantId: tenant.id,
      name,
      normalizedName,
      normalizedKey: `${faker.helpers.slugify(normalizedName)}-${faker.string.uuid()}`,
      debtorType: 'union',
      paymentRegime: 'federal_unique',
      cnpj: faker.string.numeric(14),
      stateCode: 'DF',
    }
  })
  .build()
