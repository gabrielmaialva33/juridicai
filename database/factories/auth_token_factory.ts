import factory from '@adonisjs/lucid/factories'
import AuthToken from '#modules/auth/models/auth_token'
import { UserFactory } from '#database/factories/user_factory'

export const AuthTokenFactory = factory
  .define(AuthToken, async ({ faker }) => {
    const user = await UserFactory.create()

    return {
      tokenableId: user.id,
      type: 'auth_token',
      name: 'test-token',
      hash: faker.string.hexadecimal({ length: 64, prefix: '' }),
      abilities: JSON.stringify(['*']),
    }
  })
  .build()
