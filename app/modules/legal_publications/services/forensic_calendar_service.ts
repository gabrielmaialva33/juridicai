import { DateTime } from 'luxon'

const FIXED_NATIONAL_HOLIDAYS: Array<[number, number]> = [
  [1, 1],
  [4, 21],
  [5, 1],
  [9, 7],
  [10, 12],
  [11, 2],
  [11, 15],
  [11, 20],
  [12, 25],
]

export class ForensicCalendar {
  private readonly extraHolidays: Set<string>
  private readonly fixedHolidayCache = new Map<number, Set<string>>()
  private readonly movableHolidayCache = new Map<number, Set<string>>()

  constructor(extraHolidays: string[] = []) {
    this.extraHolidays = new Set(extraHolidays)
  }

  isWorkingDay(date: DateTime) {
    const day = date.startOf('day')

    if (day.weekday === 6 || day.weekday === 7) {
      return false
    }

    const iso = day.toISODate()!

    return (
      !this.fixedNationalHolidays(day.year).has(iso) &&
      !this.movableForensicHolidays(day.year).has(iso) &&
      !this.extraHolidays.has(iso)
    )
  }

  addWorkingDays(date: DateTime, days: number) {
    let cursor = date.startOf('day')
    let remaining = Math.max(Math.trunc(days), 0)

    while (remaining > 0) {
      cursor = cursor.plus({ days: 1 })

      if (this.isWorkingDay(cursor)) {
        remaining -= 1
      }
    }

    return cursor
  }

  businessDaysBetweenExclusiveInclusive(from: DateTime, to: DateTime) {
    let count = 0
    let cursor = from.startOf('day')
    const target = to.startOf('day')

    while (cursor < target) {
      cursor = this.addWorkingDays(cursor, 1)

      if (cursor <= target) {
        count += 1
      }
    }

    return count
  }

  private fixedNationalHolidays(year: number) {
    let holidays = this.fixedHolidayCache.get(year)

    if (!holidays) {
      holidays = new Set(
        FIXED_NATIONAL_HOLIDAYS.map(([month, day]) => DateTime.utc(year, month, day).toISODate()!)
      )
      this.fixedHolidayCache.set(year, holidays)
    }

    return holidays
  }

  private movableForensicHolidays(year: number) {
    let holidays = this.movableHolidayCache.get(year)

    if (!holidays) {
      const easter = easterSunday(year)
      holidays = new Set([
        easter.minus({ days: 48 }).toISODate()!,
        easter.minus({ days: 47 }).toISODate()!,
        easter.minus({ days: 2 }).toISODate()!,
        easter.plus({ days: 60 }).toISODate()!,
      ])
      this.movableHolidayCache.set(year, holidays)
    }

    return holidays
  }
}

export function availableDateToPublicationDate(
  availableAt: DateTime,
  calendar = new ForensicCalendar()
) {
  return calendar.addWorkingDays(availableAt, 1)
}

export function easterSunday(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1

  return DateTime.utc(year, month, day).startOf('day')
}
