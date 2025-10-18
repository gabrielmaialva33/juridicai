import vine from '@vinejs/vine'

/**
 * Validator for starting a timer
 */
export const startTimerValidator = vine.compile(
  vine.object({
    case_id: vine.number().withoutDecimals().positive(),
    description: vine.string().trim().minLength(1).maxLength(500).optional(),
    billable: vine.boolean().optional(),
    hourly_rate: vine.number().min(0).optional(),
    tags: vine.array(vine.string()).optional(),
  })
)

/**
 * Validator for creating a manual time entry
 */
export const createManualEntryValidator = vine.compile(
  vine.object({
    case_id: vine.number().withoutDecimals().positive(),
    started_at: vine.string().trim(),
    ended_at: vine.string().trim(),
    description: vine.string().trim().minLength(1).maxLength(500).optional(),
    billable: vine.boolean().optional(),
    hourly_rate: vine.number().min(0).optional(),
    tags: vine.array(vine.string()).optional(),
  })
)

/**
 * Validator for updating a time entry
 */
export const updateTimeEntryValidator = vine.compile(
  vine.object({
    description: vine.string().trim().minLength(1).maxLength(500).optional(),
    billable: vine.boolean().optional(),
    hourly_rate: vine.number().min(0).optional(),
    tags: vine.array(vine.string()).optional(),
    started_at: vine.string().trim().optional(),
    ended_at: vine.string().trim().optional(),
  })
)

/**
 * Validator for listing time entries with filters
 */
export const listTimeEntriesValidator = vine.compile(
  vine.object({
    page: vine.number().withoutDecimals().min(1).optional(),
    per_page: vine.number().withoutDecimals().min(1).max(100).optional(),
    case_id: vine.number().withoutDecimals().positive().optional(),
    billable: vine.boolean().optional(),
    from_date: vine.string().trim().optional(),
    to_date: vine.string().trim().optional(),
  })
)

/**
 * Validator for stats query parameters
 */
export const statsValidator = vine.compile(
  vine.object({
    case_id: vine.number().withoutDecimals().positive().optional(),
    from_date: vine.string().trim().optional(),
    to_date: vine.string().trim().optional(),
  })
)
