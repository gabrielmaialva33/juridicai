import { inject } from '@adonisjs/core'
import TimeEntry from '#models/time_entry'
import { DateTime } from 'luxon'

interface StatsFilters {
  user_id?: number
  case_id?: number
  from_date?: DateTime
  to_date?: DateTime
}

interface TimeEntryStats {
  total_hours: number
  billable_hours: number
  non_billable_hours: number
  total_amount: number
  entries_count: number
  running_timers_count: number
}

/**
 * Service to calculate time entry statistics
 */
@inject()
export default class GetTimeEntryStatsService {
  /**
   * Get statistics for time entries
   */
  async run(filters: StatsFilters = {}): Promise<TimeEntryStats> {
    let query = TimeEntry.query().where('is_deleted', false)

    // Apply filters
    if (filters.user_id) {
      query = query.where('user_id', filters.user_id)
    }
    if (filters.case_id) {
      query = query.where('case_id', filters.case_id)
    }
    if (filters.from_date && filters.to_date) {
      query = query.whereBetween('started_at', [
        filters.from_date.toISO()!,
        filters.to_date.toISO()!,
      ])
    }

    // Get all matching entries
    const entries = await query

    // Calculate stats
    let totalMinutes = 0
    let billableMinutes = 0
    let nonBillableMinutes = 0
    let totalAmount = 0
    let runningTimers = 0

    for (const entry of entries) {
      if (entry.is_running) {
        runningTimers++
        continue // Skip running timers from duration calculations
      }

      if (entry.duration_minutes) {
        totalMinutes += entry.duration_minutes

        if (entry.billable) {
          billableMinutes += entry.duration_minutes

          // Calculate amount
          if (entry.hourly_rate) {
            const hours = entry.duration_minutes / 60
            totalAmount += hours * entry.hourly_rate
          }
        } else {
          nonBillableMinutes += entry.duration_minutes
        }
      }
    }

    return {
      total_hours: Number.parseFloat((totalMinutes / 60).toFixed(2)),
      billable_hours: Number.parseFloat((billableMinutes / 60).toFixed(2)),
      non_billable_hours: Number.parseFloat((nonBillableMinutes / 60).toFixed(2)),
      total_amount: Number.parseFloat(totalAmount.toFixed(2)),
      entries_count: entries.length - runningTimers,
      running_timers_count: runningTimers,
    }
  }
}
