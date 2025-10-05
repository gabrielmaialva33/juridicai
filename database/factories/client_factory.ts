import factory from '@adonisjs/lucid/factories'
import { FactoryContextContract } from '@adonisjs/lucid/types/factory'
import Client from '#models/client'

/**
 * Generate a valid Brazilian CPF (simplified for testing)
 */
function generateCPF(faker: any): string {
  const digits = Array.from({ length: 9 }, () => faker.number.int({ min: 0, max: 9 }))

  // Calculate first digit
  let sum = digits.reduce((acc, digit, i) => acc + digit * (10 - i), 0)
  const digit1 = (sum * 10) % 11 === 10 ? 0 : (sum * 10) % 11

  // Calculate second digit
  sum = [...digits, digit1].reduce((acc, digit, i) => acc + digit * (11 - i), 0)
  const digit2 = (sum * 10) % 11 === 10 ? 0 : (sum * 10) % 11

  const cpf = [...digits, digit1, digit2].join('')
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

/**
 * Generate a valid Brazilian CNPJ (simplified for testing)
 */
function generateCNPJ(faker: any): string {
  const digits = Array.from({ length: 12 }, () => faker.number.int({ min: 0, max: 9 }))

  // Calculate first digit
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let sum = digits.reduce((acc, digit, i) => acc + digit * weights1[i], 0)
  const digit1 = sum % 11 < 2 ? 0 : 11 - (sum % 11)

  // Calculate second digit
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  sum = [...digits, digit1].reduce((acc, digit, i) => acc + digit * weights2[i], 0)
  const digit2 = sum % 11 < 2 ? 0 : 11 - (sum % 11)

  const cnpj = [...digits, digit1, digit2].join('')
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

export const ClientFactory = factory
  .define(Client, async ({ faker }: FactoryContextContract) => {
    // Default: individual client
    return {
      client_type: 'individual' as const,
      full_name: faker.person.fullName(),
      cpf: generateCPF(faker),
      company_name: null,
      cnpj: null,
      phone: `(${faker.string.numeric(2)}) 9${faker.string.numeric(4)}-${faker.string.numeric(4)}`,
      email: faker.internet.email().toLowerCase(),
      address: {
        street: faker.location.streetAddress(),
        number: faker.location.buildingNumber(),
        complement: faker.datatype.boolean() ? faker.location.secondaryAddress() : undefined,
        neighborhood: faker.location.county(),
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        zip_code: faker.location.zipCode('#####-###'),
        country: 'Brasil',
      },
      tags: faker.helpers.arrayElements(['vip', 'empresarial', 'trabalhista', 'familia'], {
        min: 0,
        max: 2,
      }),
      custom_fields: null,
      notes: faker.helpers.arrayElement([faker.lorem.paragraph(), null]),
      is_active: true,
    }
  })
  .state('individual', (client) => {
    // Already default, but explicitly set
    client.client_type = 'individual'
    client.company_name = null
    client.cnpj = null
  })
  .state('company', (client, ctx) => {
    const { faker } = ctx
    client.client_type = 'company'
    client.company_name = faker.company.name()
    client.cnpj = generateCNPJ(faker)
    client.full_name = null
    client.cpf = null
  })
  .state('inactive', (client) => {
    client.is_active = false
  })
  .state('vip', (client) => {
    client.tags = ['vip', 'prioridade']
  })
  .build()
