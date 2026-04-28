import factory from '@adonisjs/lucid/factories'
import Permission from '#modules/permission/models/permission'

export const PermissionFactory = factory
  .define(Permission, ({ faker }) => {
    const slug = `test.${faker.string.uuid()}`

    return {
      name: faker.word.words({ count: 2 }),
      slug,
      description: faker.lorem.sentence(),
    }
  })
  .build()
