import CourtHoliday from '#modules/legal_publications/models/court_holiday'

class CourtHolidayRepository {
  query() {
    return CourtHoliday.query()
  }

  async listCalendarDates(courtAlias: string | null, years: number[]) {
    if (years.length === 0) {
      return []
    }

    const [firstYear, lastYear] = yearBounds(years)
    const query = this.query().whereBetween('date', [`${firstYear}-01-01`, `${lastYear}-12-31`])

    query.where((builder) => {
      builder.where('scope', 'national')

      if (courtAlias) {
        builder.orWhere((courtBuilder) => {
          courtBuilder.where('scope', 'court').where('court_alias', courtAlias.toUpperCase())
        })
      }
    })

    const rows = await query.exec()
    return rows.map((row) => row.date.toISODate()!).filter(Boolean)
  }

  async hasCourtCalendar(courtAlias: string | null, years: number[]) {
    if (!courtAlias || years.length === 0) {
      return false
    }

    const row = await this.query()
      .where('scope', 'court')
      .where('court_alias', courtAlias.toUpperCase())
      .whereBetween('date', [`${Math.min(...years)}-01-01`, `${Math.max(...years)}-12-31`])
      .first()

    return Boolean(row)
  }
}

function yearBounds(years: number[]) {
  const uniqueYears = [...new Set(years)]
  return [Math.min(...uniqueYears), Math.max(...uniqueYears)] as const
}

export default new CourtHolidayRepository()
