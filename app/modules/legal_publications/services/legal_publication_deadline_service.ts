import { DateTime } from 'luxon'
import type LegalPublication from '#modules/legal_publications/models/legal_publication'
import { type DeadlineKind } from '#modules/legal_publications/models/legal_publication'
import courtHolidayRepository from '#modules/legal_publications/repositories/court_holiday_repository'
import legalPublicationRepository from '#modules/legal_publications/repositories/legal_publication_repository'
import legalPublicationEventRepository from '#modules/legal_publications/repositories/legal_publication_event_repository'
import {
  availableDateToPublicationDate,
  ForensicCalendar,
} from '#modules/legal_publications/services/forensic_calendar_service'

type DeadlineCalculationInput = {
  availableAt: DateTime | null
  publishedAt: DateTime | null
  deadlineDays: number | null
  deadlineKind: DeadlineKind | null
  manualDueAt?: DateTime | null
  courtAlias?: string | null
  courtHolidayDates?: string[]
  courtCalendarVerified?: boolean
  today?: DateTime
}

export type DeadlineCalculationResult = {
  publishedAt: DateTime | null
  dueAt: DateTime | null
  overdue: boolean
  partialCalendar: boolean
  manualReviewRequired: boolean
  deadlineReason: string | null
  deadlineItems: Array<Record<string, unknown>>
}

class LegalPublicationDeadlineService {
  async calculateAndPersist(publication: LegalPublication) {
    const years = deadlineCandidateYears(publication.availableAt, publication.publishedAt)
    const courtAlias = publication.courtAlias?.toUpperCase() ?? null
    const [courtHolidayDates, courtCalendarVerified] = await Promise.all([
      courtHolidayRepository.listCalendarDates(courtAlias, years),
      courtHolidayRepository.hasCourtCalendar(courtAlias, years),
    ])
    const result = calculateDeadline({
      availableAt: publication.availableAt,
      publishedAt: publication.publishedAt,
      deadlineDays: publication.deadlineDays,
      deadlineKind: publication.deadlineKind,
      manualDueAt: publication.manualDueAt,
      courtAlias,
      courtHolidayDates,
      courtCalendarVerified,
    })

    await legalPublicationRepository.applyDeadlineCalculation(publication, result)
    await legalPublicationEventRepository.createEvent(publication.tenantId, {
      legalPublicationId: publication.id,
      eventType: 'deadline_calculated',
      payload: {
        dueAt: result.dueAt?.toISODate() ?? null,
        publishedAt: result.publishedAt?.toISODate() ?? null,
        partialCalendar: result.partialCalendar,
        reason: result.deadlineReason,
      },
    })

    return result
  }
}

export function calculateDeadline(input: DeadlineCalculationInput): DeadlineCalculationResult {
  const today = (input.today ?? DateTime.utc()).startOf('day')
  const calendar = new ForensicCalendar(input.courtHolidayDates ?? [])
  const partialCalendar = Boolean(input.courtAlias && input.courtCalendarVerified !== true)
  const publishedAt =
    input.publishedAt ??
    (input.availableAt ? availableDateToPublicationDate(input.availableAt, calendar) : null)

  if (input.manualDueAt) {
    const dueAt = input.manualDueAt.startOf('day')
    return {
      publishedAt,
      dueAt,
      overdue: dueAt < today,
      partialCalendar,
      manualReviewRequired: partialCalendar,
      deadlineReason: partialCalendar ? 'manual_due_date_with_partial_calendar' : 'manual_due_date',
      deadlineItems: [{ kind: 'manual_due_date', dueAt: dueAt.toISODate() }],
    }
  }

  if (!publishedAt || !input.deadlineDays || !input.deadlineKind) {
    return {
      publishedAt,
      dueAt: null,
      overdue: false,
      partialCalendar,
      manualReviewRequired: false,
      deadlineReason: 'missing_deadline_data',
      deadlineItems: [],
    }
  }

  const dueAt = rollForwardToWorkingDay(
    applyCourtRecessSuspension(publishedAt, input.deadlineDays, input.deadlineKind, calendar),
    calendar
  )

  return {
    publishedAt,
    dueAt,
    overdue: dueAt < today,
    partialCalendar,
    manualReviewRequired: partialCalendar,
    deadlineReason: partialCalendar ? 'partial_court_calendar' : null,
    deadlineItems: [
      {
        kind: input.deadlineKind,
        days: input.deadlineDays,
        startsAt: publishedAt.toISODate(),
        dueAt: dueAt.toISODate(),
      },
    ],
  }
}

function applyCourtRecessSuspension(
  publishedAt: DateTime,
  days: number,
  kind: DeadlineKind,
  calendar: ForensicCalendar
) {
  for (const year of [publishedAt.year, publishedAt.year + 1]) {
    const recessStart = DateTime.utc(year, 12, 20).startOf('day')
    const recessEnd = DateTime.utc(year + 1, 1, 20).startOf('day')

    if (publishedAt >= recessStart) {
      continue
    }

    if (kind === 'business_days') {
      const attempt = calendar.addWorkingDays(publishedAt, days)

      if (attempt < recessStart) {
        return attempt
      }

      let daysBeforeRecess = 0
      let cursor = publishedAt

      while (true) {
        const next = calendar.addWorkingDays(cursor, 1)

        if (next >= recessStart) {
          break
        }

        daysBeforeRecess += 1
        cursor = next
      }

      const remaining = days - daysBeforeRecess
      let resumedAt = recessEnd.plus({ days: 1 })

      while (!calendar.isWorkingDay(resumedAt)) {
        resumedAt = resumedAt.plus({ days: 1 })
      }

      return calendar.addWorkingDays(resumedAt, Math.max(remaining - 1, 0))
    }

    const attempt = publishedAt.plus({ days })

    if (attempt < recessStart) {
      return attempt
    }

    const daysBeforeRecess = Math.floor(recessStart.diff(publishedAt, 'days').days)
    const remaining = days - daysBeforeRecess

    return recessEnd.plus({ days: 1 + remaining })
  }

  return kind === 'business_days'
    ? calendar.addWorkingDays(publishedAt, days)
    : publishedAt.plus({ days })
}

function rollForwardToWorkingDay(date: DateTime, calendar: ForensicCalendar) {
  let cursor = date.startOf('day')

  while (!calendar.isWorkingDay(cursor)) {
    cursor = cursor.plus({ days: 1 })
  }

  return cursor
}

function deadlineCandidateYears(...dates: Array<DateTime | null>) {
  const years = new Set<number>()

  for (const date of dates) {
    if (date) {
      years.add(date.year)
      years.add(date.year + 1)
    }
  }

  return [...years]
}

export default new LegalPublicationDeadlineService()
