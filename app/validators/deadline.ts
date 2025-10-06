import vine from '@vinejs/vine'

/**
 * Validator for creating a new deadline
 */
export const createDeadlineValidator = vine.compile(
  vine.object({
    // Required: Case relationship
    case_id: vine.number().min(1),

    // Required: Responsible user
    responsible_id: vine.number().min(1),

    // Required: Title and deadline date
    title: vine.string().trim().minLength(3).maxLength(255),
    deadline_date: vine.date({ formats: ['YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss'] }),

    // Optional fields
    description: vine.string().trim().maxLength(5000).nullable().optional(),

    // Internal deadline (safety margin)
    internal_deadline_date: vine
      .date({ formats: ['YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss'] })
      .nullable()
      .optional(),

    // Fatal deadline flag (cannot miss)
    is_fatal: vine.boolean().optional(),

    // Status
    status: vine.enum(['pending', 'completed', 'expired', 'cancelled']).optional(),

    // Alert configuration (JSONB)
    alert_config: vine
      .object({
        alerts: vine
          .array(
            vine.object({
              days_before: vine.number().min(0).max(365),
              channels: vine.array(vine.enum(['email', 'sms', 'push', 'whatsapp'])).minLength(1),
            })
          )
          .optional(),
        enabled: vine.boolean().optional(),
        recipients: vine.array(vine.number().min(1)).optional(), // Array of user_ids
      })
      .nullable()
      .optional(),
  })
)

/**
 * Validator for updating an existing deadline
 * All fields are optional for PATCH updates
 */
export const updateDeadlineValidator = vine.compile(
  vine.object({
    // Case relationship
    case_id: vine.number().min(1).optional(),

    // Responsible user
    responsible_id: vine.number().min(1).optional(),

    // Title and dates
    title: vine.string().trim().minLength(3).maxLength(255).optional(),
    deadline_date: vine.date({ formats: ['YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss'] }).optional(),
    description: vine.string().trim().maxLength(5000).nullable().optional(),

    // Internal deadline
    internal_deadline_date: vine
      .date({ formats: ['YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss'] })
      .nullable()
      .optional(),

    // Fatal deadline flag
    is_fatal: vine.boolean().optional(),

    // Status
    status: vine.enum(['pending', 'completed', 'expired', 'cancelled']).optional(),

    // Alert configuration (JSONB)
    alert_config: vine
      .object({
        alerts: vine
          .array(
            vine.object({
              days_before: vine.number().min(0).max(365),
              channels: vine.array(vine.enum(['email', 'sms', 'push', 'whatsapp'])).minLength(1),
            })
          )
          .optional(),
        enabled: vine.boolean().optional(),
        recipients: vine.array(vine.number().min(1)).optional(),
      })
      .nullable()
      .optional(),
  })
)

/**
 * Validator for completing a deadline
 */
export const completeDeadlineValidator = vine.compile(
  vine.object({
    completed_by: vine.number().min(1).optional(), // Will default to current user
    completion_notes: vine.string().trim().maxLength(1000).nullable().optional(),
  })
)

/**
 * Validator for deadline search/filter query parameters
 */
export const deadlineFilterValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    per_page: vine.number().min(1).max(100).optional(),
    case_id: vine.number().min(1).optional(),
    responsible_id: vine.number().min(1).optional(),
    status: vine.enum(['pending', 'completed', 'expired', 'cancelled']).optional(),
    is_fatal: vine.boolean().optional(),
    deadline_after: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    deadline_before: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    upcoming_days: vine.number().min(1).max(365).optional(), // Filter upcoming deadlines
    with_case: vine.boolean().optional(),
    with_responsible: vine.boolean().optional(),
  })
)

/**
 * Validator for getting upcoming deadlines
 */
export const upcomingDeadlinesValidator = vine.compile(
  vine.object({
    days: vine.number().min(1).max(365).optional(), // Default 7 days
    responsible_id: vine.number().min(1).optional(),
    is_fatal_only: vine.boolean().optional(),
  })
)
