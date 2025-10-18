import vine from '@vinejs/vine'

/**
 * Validator for legal research requests
 */
export const legalResearchValidator = vine.compile(
  vine.object({
    // Required fields
    topic: vine.string().trim().minLength(3).maxLength(500),

    // Optional fields
    court: vine.string().trim().maxLength(100).optional(),
    year_range: vine
      .object({
        from: vine.number().min(1900).max(new Date().getFullYear()).optional(),
        to: vine.number().min(1900).max(new Date().getFullYear()).optional(),
      })
      .optional(),
    recency: vine.enum(['day', 'week', 'month', 'year']).optional(),
    case_id: vine.number().min(1).optional(),
    model: vine.string().trim().maxLength(100).optional(),
    max_tokens: vine.number().min(100).max(16000).optional(),
    temperature: vine.number().min(0).max(2).optional(),
  })
)

/**
 * Validator for legislation search requests
 */
export const legislationSearchValidator = vine.compile(
  vine.object({
    // Required fields
    topic: vine.string().trim().minLength(3).maxLength(500),

    // Optional fields
    legislation_type: vine.string().trim().maxLength(100).optional(),
    recency: vine.enum(['day', 'week', 'month', 'year']).optional(),
    case_id: vine.number().min(1).optional(),
    model: vine.string().trim().maxLength(100).optional(),
    max_tokens: vine.number().min(100).max(16000).optional(),
    temperature: vine.number().min(0).max(2).optional(),
  })
)

/**
 * Validator for case analysis requests
 */
export const caseAnalysisValidator = vine.compile(
  vine.object({
    // Required fields
    case_summary: vine.string().trim().minLength(10).maxLength(5000),

    // Optional fields
    legal_area: vine.string().trim().maxLength(200).optional(),
    questions: vine.array(vine.string().trim().minLength(5).maxLength(500)).optional(),
    case_id: vine.number().min(1).optional(),
    model: vine.string().trim().maxLength(100).optional(),
    max_tokens: vine.number().min(100).max(16000).optional(),
    temperature: vine.number().min(0).max(2).optional(),
  })
)

/**
 * Validator for legal writing assistance requests
 */
export const legalWritingValidator = vine.compile(
  vine.object({
    // Required fields
    document_type: vine.string().trim().minLength(3).maxLength(200),
    context: vine.string().trim().minLength(10).maxLength(5000),

    // Optional fields
    style: vine.enum(['formal', 'concise', 'detailed']).optional(),
    case_id: vine.number().min(1).optional(),
    model: vine.string().trim().maxLength(100).optional(),
    max_tokens: vine.number().min(100).max(16000).optional(),
    temperature: vine.number().min(0).max(2).optional(),
  })
)

/**
 * Validator for search history query parameters
 */
export const searchHistoryValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    per_page: vine.number().min(1).max(100).optional(),
    search_type: vine
      .enum(['legal_research', 'legislation', 'case_analysis', 'legal_writing', 'general'])
      .optional(),
    case_id: vine.number().min(1).optional(),
    search_term: vine.string().trim().minLength(1).maxLength(255).optional(),
    from_date: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    to_date: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
  })
)
