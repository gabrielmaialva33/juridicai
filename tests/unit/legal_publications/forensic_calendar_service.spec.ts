import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import {
  availableDateToPublicationDate,
  ForensicCalendar,
} from '#modules/legal_publications/services/forensic_calendar_service'
import { calculateDeadline } from '#modules/legal_publications/services/legal_publication_deadline_service'

test.group('legal publications forensic calendar', () => {
  test('moves DJEN availability to the next forensic working publication day', ({ assert }) => {
    const availableAt = DateTime.utc(2026, 4, 30)
    const publishedAt = availableDateToPublicationDate(availableAt, new ForensicCalendar())

    assert.equal(publishedAt.toISODate(), '2026-05-04')
  })

  test('calculates business-day deadlines and rolls fixed-holiday endings forward', ({
    assert,
  }) => {
    const result = calculateDeadline({
      availableAt: null,
      publishedAt: DateTime.utc(2026, 4, 30),
      deadlineDays: 1,
      deadlineKind: 'business_days',
      today: DateTime.utc(2026, 4, 30),
    })

    assert.equal(result.dueAt?.toISODate(), '2026-05-04')
    assert.isFalse(result.overdue)
    assert.isFalse(result.manualReviewRequired)
  })

  test('uses injected court holidays and clears partial-calendar review when verified', ({
    assert,
  }) => {
    const result = calculateDeadline({
      availableAt: null,
      publishedAt: DateTime.utc(2026, 7, 8),
      deadlineDays: 1,
      deadlineKind: 'business_days',
      courtAlias: 'TJSP',
      courtHolidayDates: ['2026-07-09'],
      courtCalendarVerified: true,
      today: DateTime.utc(2026, 7, 8),
    })

    assert.equal(result.dueAt?.toISODate(), '2026-07-10')
    assert.isFalse(result.partialCalendar)
    assert.isFalse(result.manualReviewRequired)
  })

  test('marks court-specific calculations as partial when no court calendar is verified', ({
    assert,
  }) => {
    const result = calculateDeadline({
      availableAt: null,
      publishedAt: DateTime.utc(2026, 7, 8),
      deadlineDays: 1,
      deadlineKind: 'business_days',
      courtAlias: 'TJSP',
      courtHolidayDates: [],
      courtCalendarVerified: false,
      today: DateTime.utc(2026, 7, 8),
    })

    assert.equal(result.dueAt?.toISODate(), '2026-07-09')
    assert.isTrue(result.partialCalendar)
    assert.isTrue(result.manualReviewRequired)
    assert.equal(result.deadlineReason, 'partial_court_calendar')
  })
})
