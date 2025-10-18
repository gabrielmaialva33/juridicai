import { inject } from '@adonisjs/core'
import TimeEntry from '#models/time_entry'
import Case from '#models/case'
import NotFoundException from '#exceptions/not_found_exception'
import BadRequestException from '#exceptions/bad_request_exception'
import { DateTime } from 'luxon'

interface CreateManualEntryPayload {
  user_id: number
  case_id: number
  started_at: string | DateTime
  ended_at: string | DateTime
  description?: string
  billable?: boolean
  hourly_rate?: number
  tags?: string[]
}

/**
 * Service to create a manual time entry (not using timer)
 */
@inject()
export default class CreateManualEntryService {
  /**
   * Create a manual time entry
   */
  async run(payload: CreateManualEntryPayload): Promise<TimeEntry> {
    // Verify case exists
    const caseRecord = await Case.find(payload.case_id)
    if (!caseRecord) {
      throw new NotFoundException(`Case with ID ${payload.case_id} not found`)
    }

    // Parse dates
    const startedAt =
      typeof payload.started_at === 'string'
        ? DateTime.fromISO(payload.started_at)
        : payload.started_at
    const endedAt =
      typeof payload.ended_at === 'string' ? DateTime.fromISO(payload.ended_at) : payload.ended_at

    // Validate dates
    if (!startedAt.isValid) {
      throw new BadRequestException('Invalid started_at date')
    }
    if (!endedAt.isValid) {
      throw new BadRequestException('Invalid ended_at date')
    }
    if (endedAt <= startedAt) {
      throw new BadRequestException('ended_at must be after started_at')
    }

    // Calculate duration
    const durationMinutes = Math.round(endedAt.diff(startedAt, 'minutes').minutes)

    // Create time entry
    const timeEntry = await TimeEntry.create({
      user_id: payload.user_id,
      case_id: payload.case_id,
      started_at: startedAt,
      ended_at: endedAt,
      duration_minutes: durationMinutes,
      description: payload.description ?? null,
      billable: payload.billable ?? true,
      hourly_rate: payload.hourly_rate ?? null,
      tags: payload.tags ?? [],
    })

    return timeEntry
  }
}
