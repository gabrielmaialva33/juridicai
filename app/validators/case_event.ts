import vine from '@vinejs/vine'

/**
 * Validator for creating a new case event
 */
export const createCaseEventValidator = vine.compile(
  vine.object({
    // Required: Case relationship
    case_id: vine.number().min(1),

    // Required: Event type and title
    event_type: vine.enum([
      'filing',
      'hearing',
      'decision',
      'publication',
      'appeal',
      'motion',
      'settlement',
      'judgment',
      'other',
    ]),
    title: vine.string().trim().minLength(3).maxLength(255),

    // Optional description
    description: vine.string().trim().maxLength(5000).nullable().optional(),

    // Required: Event date
    event_date: vine.date({ formats: ['YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss'] }),

    // Source of the event
    source: vine.enum(['manual', 'court_api', 'email', 'import']).optional(),

    // Metadata (JSONB) - Flexible structure for different event types
    metadata: vine
      .object({
        // Court-related metadata
        court_document_id: vine.string().trim().maxLength(100).optional(),
        judge: vine.string().trim().maxLength(255).optional(),
        court_session: vine.string().trim().maxLength(100).optional(),

        // Hearing-specific
        hearing_type: vine.string().trim().maxLength(100).optional(),
        hearing_location: vine.string().trim().maxLength(255).optional(),
        attendees: vine.array(vine.string().trim().maxLength(255)).optional(),

        // Decision/Judgment-specific
        decision_type: vine.string().trim().maxLength(100).optional(),
        favorable: vine.boolean().optional(),
        amount: vine.number().min(0).optional(),

        // Publication-specific
        publication_source: vine.string().trim().maxLength(255).optional(),
        publication_url: vine.string().trim().url().optional(),

        // Additional custom fields
        custom: vine.record(vine.any()).optional(),
      })
      .nullable()
      .optional(),

    // Creator (will be set automatically from auth.user if not provided)
    created_by: vine.number().min(1).nullable().optional(),
  })
)

/**
 * Validator for updating an existing case event
 */
export const updateCaseEventValidator = vine.compile(
  vine.object({
    // Case relationship
    case_id: vine.number().min(1).optional(),

    // Event type and title
    event_type: vine
      .enum([
        'filing',
        'hearing',
        'decision',
        'publication',
        'appeal',
        'motion',
        'settlement',
        'judgment',
        'other',
      ])
      .optional(),
    title: vine.string().trim().minLength(3).maxLength(255).optional(),

    // Description
    description: vine.string().trim().maxLength(5000).nullable().optional(),

    // Event date
    event_date: vine.date({ formats: ['YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss'] }).optional(),

    // Source
    source: vine.enum(['manual', 'court_api', 'email', 'import']).optional(),

    // Metadata (JSONB)
    metadata: vine
      .object({
        court_document_id: vine.string().trim().maxLength(100).optional(),
        judge: vine.string().trim().maxLength(255).optional(),
        court_session: vine.string().trim().maxLength(100).optional(),
        hearing_type: vine.string().trim().maxLength(100).optional(),
        hearing_location: vine.string().trim().maxLength(255).optional(),
        attendees: vine.array(vine.string().trim().maxLength(255)).optional(),
        decision_type: vine.string().trim().maxLength(100).optional(),
        favorable: vine.boolean().optional(),
        amount: vine.number().min(0).optional(),
        publication_source: vine.string().trim().maxLength(255).optional(),
        publication_url: vine.string().trim().url().optional(),
        custom: vine.record(vine.any()).optional(),
      })
      .nullable()
      .optional(),
  })
)

/**
 * Validator for case event search/filter query parameters
 */
export const caseEventFilterValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    per_page: vine.number().min(1).max(100).optional(),
    search: vine.string().trim().minLength(1).maxLength(255).optional(),
    case_id: vine.number().min(1).optional(),
    event_type: vine
      .enum([
        'filing',
        'hearing',
        'decision',
        'publication',
        'appeal',
        'motion',
        'settlement',
        'judgment',
        'other',
      ])
      .optional(),
    source: vine.enum(['manual', 'court_api', 'email', 'import']).optional(),
    created_by: vine.number().min(1).optional(),
    event_after: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    event_before: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    with_case: vine.boolean().optional(),
    with_creator: vine.boolean().optional(),
  })
)

/**
 * Validator for bulk creating events (e.g., from court API import)
 */
export const bulkCreateCaseEventsValidator = vine.compile(
  vine.object({
    case_id: vine.number().min(1),
    events: vine.array(
      vine.object({
        event_type: vine.enum([
          'filing',
          'hearing',
          'decision',
          'publication',
          'appeal',
          'motion',
          'settlement',
          'judgment',
          'other',
        ]),
        title: vine.string().trim().minLength(3).maxLength(255),
        description: vine.string().trim().maxLength(5000).nullable().optional(),
        event_date: vine.date({ formats: ['YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss'] }),
        source: vine.enum(['manual', 'court_api', 'email', 'import']).optional(),
        metadata: vine.record(vine.any()).nullable().optional(),
      })
    ),
  })
)
