import vine from '@vinejs/vine'

/**
 * Validator for document analysis request
 */
export const documentAnalysisValidator = vine.compile(
  vine.object({
    document_text: vine.string().trim().minLength(10),
    analysis_type: vine
      .enum(['summary', 'key_points', 'parties', 'obligations', 'risks', 'full'])
      .optional(),
    model: vine.string().trim().optional(),
    temperature: vine.number().min(0).max(2).optional(),
    top_p: vine.number().min(0).max(1).optional(),
    max_tokens: vine.number().min(100).max(10000).optional(),
    case_id: vine.number().positive().optional(),
  })
)

/**
 * Validator for contract review request
 */
export const contractReviewValidator = vine.compile(
  vine.object({
    contract_text: vine.string().trim().minLength(10),
    review_focus: vine
      .array(vine.enum(['risks', 'missing_clauses', 'compliance', 'obligations', 'all']))
      .optional(),
    model: vine.string().trim().optional(),
    temperature: vine.number().min(0).max(2).optional(),
    top_p: vine.number().min(0).max(1).optional(),
    max_tokens: vine.number().min(100).max(10000).optional(),
    case_id: vine.number().positive().optional(),
  })
)

/**
 * Validator for code generation request
 */
export const codeGenerationValidator = vine.compile(
  vine.object({
    template_type: vine.string().trim().minLength(3),
    context: vine.string().trim().minLength(10),
    style: vine.enum(['formal', 'concise', 'detailed']).optional(),
    model: vine.string().trim().optional(),
    temperature: vine.number().min(0).max(2).optional(),
    top_p: vine.number().min(0).max(1).optional(),
    max_tokens: vine.number().min(100).max(10000).optional(),
    case_id: vine.number().positive().optional(),
  })
)

/**
 * Validator for text analysis request
 */
export const textAnalysisValidator = vine.compile(
  vine.object({
    text: vine.string().trim().minLength(10),
    goal: vine.string().trim().optional(),
    model: vine.string().trim().optional(),
    temperature: vine.number().min(0).max(2).optional(),
    top_p: vine.number().min(0).max(1).optional(),
    max_tokens: vine.number().min(100).max(10000).optional(),
    case_id: vine.number().positive().optional(),
  })
)

/**
 * Validator for query history filters
 */
export const queryHistoryValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    query_type: vine
      .enum(['document_analysis', 'contract_review', 'code_generation', 'text_analysis', 'general'])
      .optional(),
    user_id: vine.number().positive().optional(),
    case_id: vine.number().positive().optional(),
    search: vine.string().trim().optional(),
  })
)
