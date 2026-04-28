import factory from '@adonisjs/lucid/factories'
import Role from '#modules/permission/models/role'

export const RoleFactory = factory
  .define(Role, ({ faker }) => {
    const name = faker.word.words({ count: 2 })

    return {
      name,
      slug: `${faker.helpers.slugify(name).toLowerCase()}-${faker.string.uuid()}`,
      description: faker.lorem.sentence(),
    }
  })
  .build()
