import factory from '@adonisjs/lucid/factories'
import { FactoryContextContract } from '@adonisjs/lucid/types/factory'
import { DateTime } from 'luxon'
import Case from '#models/case'
import { ClientFactory } from './client_factory.js'
import { UserFactory } from './user_factory.js'

/**
 * Generate a valid Brazilian CNJ format process number
 * Format: NNNNNNN-DD.AAAA.J.TR.OOOO
 * - NNNNNNN: Sequential number (7 digits)
 * - DD: Check digits (2 digits)
 * - AAAA: Year (4 digits)
 * - J: Judicial segment (1 digit)
 * - TR: Court (2 digits)
 * - OOOO: Origin (4 digits)
 */
function generateCNJNumber(faker: any): string {
  const sequential = faker.string.numeric(7)
  const year = faker.date.past({ years: 5 }).getFullYear()
  const segment = faker.helpers.arrayElement(['1', '2', '3', '4', '5', '6', '8'])
  const court = faker.string.numeric(2)
  const origin = faker.string.numeric(4)

  // Simplified check digit calculation (not the real CNJ algorithm)
  const base = sequential + year.toString() + segment + court + origin
  const checkDigit = (parseInt(base.substring(0, 10)) % 97).toString().padStart(2, '0')

  return `${sequential}-${checkDigit}.${year}.${segment}.${court}.${origin}`
}

export const CaseFactory = factory
  .define(Case, async ({ faker }: FactoryContextContract) => {
    return {
      case_number: generateCNJNumber(faker),
      internal_number: faker.string.alphanumeric(10).toUpperCase(),
      case_type: faker.helpers.arrayElement([
        'civil',
        'criminal',
        'labor',
        'family',
        'tax',
        'administrative',
        'other',
      ] as const),
      description: faker.lorem.paragraph(),
      status: faker.helpers.arrayElement(['active', 'closed', 'archived', 'suspended'] as const),
      priority: faker.helpers.arrayElement(['low', 'medium', 'high', 'urgent'] as const),
      court: faker.helpers.arrayElement([
        'Tribunal de Justiça de São Paulo - TJ-SP',
        'Tribunal Regional do Trabalho da 2ª Região - TRT-2',
        'Tribunal Regional Federal da 3ª Região - TRF-3',
        'Superior Tribunal de Justiça - STJ',
      ]),
      court_instance: faker.helpers.arrayElement([
        '1ª instância',
        '2ª instância',
        'Superior',
      ] as const),
      case_value: faker.number.float({ min: 1000, max: 500000, fractionDigits: 2 }),
      team_members: [],
      parties: {
        plaintiffs: [
          {
            name: faker.person.fullName(),
            role: 'Autor',
            cpf: faker.string.numeric(11),
          },
        ],
        defendants: [
          {
            name: faker.company.name(),
            role: 'Réu',
            cnpj: faker.string.numeric(14),
          },
        ],
      },
      tags: faker.helpers.arrayElements(['urgente', 'trabalhista', 'familia', 'civel'], {
        min: 0,
        max: 2,
      }),
      custom_fields: null,
      filed_at: DateTime.fromJSDate(faker.date.past({ years: 2 })),
      closed_at: null,
    }
  })
  .relation('client', () => ClientFactory)
  .relation('responsible_lawyer', () => UserFactory)
  .state('active', (caseModel) => {
    caseModel.status = 'active'
    caseModel.closed_at = null
  })
  .state('closed', (caseModel, ctx) => {
    caseModel.status = 'closed'
    caseModel.closed_at = DateTime.fromJSDate(ctx.faker.date.recent({ days: 30 }))
  })
  .state('archived', (caseModel, ctx) => {
    caseModel.status = 'archived'
    caseModel.closed_at = DateTime.fromJSDate(ctx.faker.date.past({ years: 1 }))
  })
  .state('urgent', (caseModel) => {
    caseModel.priority = 'urgent'
    caseModel.tags = ['urgente', 'prioridade']
  })
  .state('labor', (caseModel) => {
    caseModel.case_type = 'labor'
    caseModel.court = 'Tribunal Regional do Trabalho da 2ª Região - TRT-2'
  })
  .state('family', (caseModel) => {
    caseModel.case_type = 'family'
    caseModel.court = 'Tribunal de Justiça de São Paulo - TJ-SP'
  })
  .build()
