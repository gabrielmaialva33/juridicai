import factory from '@adonisjs/lucid/factories'
import User from '#modules/auth/models/user'

export const UserFactory = factory
  .define(User, ({ faker }) => {
    return {
      fullName: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      password: 'secret123',
      status: 'active',
    }
  })
  .build()
