import factory from '@adonisjs/lucid/factories'
import { FactoryContextContract } from '@adonisjs/lucid/types/factory'
import { DateTime } from 'luxon'
import CaseEvent from '#models/case_event'
import { UserFactory } from './user_factory.js'

export const CaseEventFactory = factory
  .define(CaseEvent, async ({ faker }: FactoryContextContract) => {
    const eventType = faker.helpers.arrayElement([
      'filing',
      'hearing',
      'decision',
      'publication',
      'appeal',
      'motion',
      'settlement',
      'judgment',
      'other',
    ] as const)

    const eventTitles = {
      filing: ['Distribuição do Processo', 'Protocolo de Petição', 'Autuação do Processo'],
      hearing: ['Audiência de Conciliação', 'Audiência de Instrução', 'Audiência Trabalhista'],
      decision: ['Decisão Interlocutória', 'Despacho do Juiz', 'Decisão Liminar'],
      publication: ['Publicação de Sentença', 'Publicação de Acórdão', 'Intimação das Partes'],
      appeal: ['Interposição de Recurso', 'Recurso Ordinário', 'Agravo de Instrumento'],
      motion: ['Pedido de Reconsideração', 'Pedido de Esclarecimento', 'Embargos de Declaração'],
      settlement: ['Acordo Homologado', 'Tentativa de Conciliação', 'Proposta de Acordo'],
      judgment: ['Sentença Proferida', 'Acórdão', 'Trânsito em Julgado'],
      other: ['Movimentação Processual', 'Atualização do Processo', 'Evento Diverso'],
    }

    return {
      event_type: eventType,
      title: faker.helpers.arrayElement(eventTitles[eventType]),
      description: faker.helpers.arrayElement([faker.lorem.paragraph(), null]),
      event_date: DateTime.fromJSDate(
        faker.date.between({
          from: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
          to: new Date(),
        })
      ),
      source: faker.helpers.arrayElement(['manual', 'court_api', 'email', 'import'] as const),
      metadata: faker.helpers.arrayElement([
        {
          location: faker.location.city(),
          participants: [faker.person.fullName(), faker.person.fullName()],
        },
        null,
      ]),
    }
  })
  .relation('creator', () => UserFactory)
  .state('filing', (event, ctx) => {
    event.event_type = 'filing'
    event.title = ctx.faker.helpers.arrayElement([
      'Distribuição do Processo',
      'Protocolo de Petição',
    ])
    event.source = 'court_api'
  })
  .state('hearing', (event, ctx) => {
    event.event_type = 'hearing'
    event.title = 'Audiência de Conciliação'
    event.event_date = DateTime.fromJSDate(ctx.faker.date.soon({ days: 30 }))
    event.source = 'court_api'
    event.metadata = {
      location: ctx.faker.location.streetAddress(),
      time: '14:00',
      judge: ctx.faker.person.fullName(),
      room: ctx.faker.number.int({ min: 1, max: 20 }).toString(),
    }
  })
  .state('decision', (event) => {
    event.event_type = 'decision'
    event.title = 'Decisão Interlocutória'
    event.source = 'court_api'
  })
  .state('publication', (event) => {
    event.event_type = 'publication'
    event.title = 'Publicação de Sentença'
    event.source = 'court_api'
  })
  .state('judgment', (event, ctx) => {
    event.event_type = 'judgment'
    event.title = 'Sentença Proferida'
    event.source = 'court_api'
    event.metadata = {
      outcome: ctx.faker.helpers.arrayElement([
        'procedente',
        'improcedente',
        'parcialmente_procedente',
      ]),
      judge: ctx.faker.person.fullName(),
    }
  })
  .state('manual', (event) => {
    event.source = 'manual'
  })
  .state('court_api', (event) => {
    event.source = 'court_api'
  })
  .state('recent', (event, ctx) => {
    event.event_date = DateTime.fromJSDate(ctx.faker.date.recent({ days: 7 }))
  })
  .build()
