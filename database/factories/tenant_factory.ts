import factory from '@adonisjs/lucid/factories'
import Tenant from '#modules/tenant/models/tenant'

export const TenantFactory = factory
  .define(Tenant, ({ faker }) => {
    const name = faker.company.name()

    return {
      name,
      slug: `${faker.helpers.slugify(name).toLowerCase()}-${faker.string.uuid()}`,
      document: faker.string.numeric(14),
      status: 'active',
      plan: 'standard',
      rbacVersion: 1,
    }
  })
  .build()
