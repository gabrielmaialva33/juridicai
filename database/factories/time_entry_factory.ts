import factory from '@adonisjs/lucid/factories'
import TimeEntry from '#models/time_entry'
import { CaseFactory } from '#database/factories/case_factory'
import { UserFactory } from '#database/factories/user_factory'
import { DateTime } from 'luxon'

export const TimeEntryFactory = factory
  .define(TimeEntry, async ({ faker }) => {
    const startedAt = DateTime.fromJSDate(
      faker.date.recent({ days: 30, refDate: DateTime.now().toJSDate() })
    )

    // 70% of entries are completed, 30% are running
    const isCompleted = faker.datatype.boolean({ probability: 0.7 })
    const endedAt = isCompleted
      ? startedAt.plus({ minutes: faker.number.int({ min: 15, max: 480 }) })
      : null

    const durationMinutes = endedAt ? endedAt.diff(startedAt, 'minutes').minutes : null

    const billable = faker.datatype.boolean({ probability: 0.8 }) // 80% billable
    const hourlyRate = billable
      ? faker.number.float({ min: 200, max: 600, fractionDigits: 2 })
      : null

    return {
      started_at: startedAt,
      ended_at: endedAt,
      duration_minutes: durationMinutes ? Math.round(durationMinutes) : null,
      description: faker.helpers.arrayElement([
        'Análise de documentos do processo',
        'Elaboração de petição inicial',
        'Pesquisa jurisprudencial',
        'Reunião com cliente',
        'Audiência judicial',
        'Redação de contrato',
        'Revisão de parecer jurídico',
        'Atendimento ao cliente',
        'Estudo de legislação aplicável',
        'Preparação para audiência',
      ]),
      billable,
      hourly_rate: hourlyRate,
      tags: faker.helpers.arrayElements(
        ['research', 'meeting', 'court', 'drafting', 'review', 'client_call', 'urgent'],
        { min: 0, max: 3 }
      ),
      is_deleted: false,
    }
  })
  .relation('caseRecord', () => CaseFactory)
  .relation('user', () => UserFactory)
  .build()
