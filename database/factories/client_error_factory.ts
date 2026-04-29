import factory from '@adonisjs/lucid/factories'
import ClientError from '#modules/client_errors/models/client_error'

export const ClientErrorFactory = factory
  .define(ClientError, async ({ faker }) => {
    return {
      status: 'new' as const,
      message: faker.lorem.sentence(),
      stackHash: faker.string.hexadecimal({ length: 40, prefix: '' }),
      payload: {},
      url: faker.internet.url(),
      userAgent: faker.internet.userAgent(),
    }
  })
  .build()
