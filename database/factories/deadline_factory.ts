import factory from '@adonisjs/lucid/factories'
import { FactoryContextContract } from '@adonisjs/lucid/types/factory'
import { DateTime } from 'luxon'
import Deadline from '#models/deadline'

export const DeadlineFactory = factory
  .define(Deadline, async ({ faker }: FactoryContextContract) => {
    const deadlineDate = DateTime.fromJSDate(
      faker.date.soon({ days: faker.number.int({ min: 5, max: 90 }) })
    )

    // Internal deadline is usually 2-5 days before the actual deadline
    const internalDeadlineDate = deadlineDate.minus({
      days: faker.number.int({ min: 2, max: 5 }),
    })

    return {
      title: faker.helpers.arrayElement([
        'Prazo para contestação',
        'Prazo para recurso',
        'Prazo para apresentação de documentos',
        'Audiência de conciliação',
        'Prazo para impugnação',
        'Prazo para réplica',
        'Prazo para alegações finais',
      ]),
      description: faker.helpers.arrayElement([faker.lorem.sentence(), null]),
      deadline_date: deadlineDate,
      internal_deadline_date: internalDeadlineDate,
      is_fatal: faker.datatype.boolean({ probability: 0.3 }), // 30% chance of being fatal
      status: 'pending' as const,
      alert_config: {
        days_before: [7, 3, 1],
        email_enabled: true,
        sms_enabled: faker.datatype.boolean({ probability: 0.4 }),
        push_enabled: true,
        recipients: [],
      },
      last_alert_sent_at: null,
      completed_at: null,
      completed_by: null,
      completion_notes: null,
    }
  })
  .state('pending', (deadline) => {
    deadline.status = 'pending'
    deadline.completed_at = null
    deadline.completed_by = null
    deadline.completion_notes = null
  })
  .state('completed', (deadline, ctx) => {
    deadline.status = 'completed'
    deadline.completed_at = DateTime.fromJSDate(ctx.faker.date.recent({ days: 5 }))
    deadline.completion_notes = 'Prazo cumprido com sucesso'
  })
  .state('expired', (deadline) => {
    deadline.status = 'expired'
    deadline.deadline_date = DateTime.now().minus({ days: 3 })
    deadline.internal_deadline_date = DateTime.now().minus({ days: 5 })
  })
  .state('cancelled', (deadline) => {
    deadline.status = 'cancelled'
  })
  .state('fatal', (deadline) => {
    deadline.is_fatal = true
    deadline.alert_config = {
      days_before: [15, 10, 7, 5, 3, 1],
      email_enabled: true,
      sms_enabled: true,
      push_enabled: true,
      recipients: [],
    }
  })
  .state('approaching', (deadline) => {
    deadline.status = 'pending'
    deadline.deadline_date = DateTime.now().plus({ days: 3 })
    deadline.internal_deadline_date = DateTime.now().plus({ days: 1 })
  })
  .state('overdue', (deadline) => {
    deadline.status = 'pending'
    deadline.deadline_date = DateTime.now().minus({ days: 2 })
    deadline.internal_deadline_date = DateTime.now().minus({ days: 4 })
  })
  .build()
