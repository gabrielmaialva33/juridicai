import vine from '@vinejs/vine'

/**
 * Validator for CNJ (Conselho Nacional de Justiça) case number
 * Format: NNNNNNN-DD.AAAA.J.TR.OOOO
 * Example: 0000001-23.2024.8.26.0100
 */
const cnjRegex = /^\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}$/

/**
 * Validator for creating a new case
 */
export const createCaseValidator = vine.compile(
  vine.object({
    // Required: Client relationship
    client_id: vine.number().min(1),

    // Case identification
    case_number: vine.string().trim().regex(cnjRegex).maxLength(50).nullable().optional(), // CNJ format
    internal_number: vine.string().trim().minLength(1).maxLength(50).nullable().optional(),

    // Classification
    case_type: vine
      .enum(['civil', 'criminal', 'labor', 'family', 'tax', 'administrative', 'other'])
      .optional(),
    court: vine.string().trim().maxLength(100).nullable().optional(), // TJ-SP, TRT-2, etc
    court_instance: vine.string().trim().maxLength(50).nullable().optional(), // 1ª, 2ª, STF, etc

    // Status
    status: vine.enum(['active', 'closed', 'archived', 'suspended']).optional(),
    priority: vine.enum(['low', 'medium', 'high', 'urgent']).optional(),

    // Team
    responsible_lawyer_id: vine.number().min(1),
    team_members: vine.array(vine.number().min(1)).nullable().optional(), // Array of user_ids

    // Dates
    filed_at: vine
      .date({ formats: ['YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss'] })
      .nullable()
      .optional(),
    closed_at: vine
      .date({ formats: ['YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss'] })
      .nullable()
      .optional(),

    // Additional data
    tags: vine.array(vine.string().trim().maxLength(50)).nullable().optional(),
    description: vine.string().trim().maxLength(5000).nullable().optional(),
    custom_fields: vine.record(vine.any()).nullable().optional(),

    // Parties (JSON)
    parties: vine
      .object({
        autor: vine
          .object({
            name: vine.string().trim().maxLength(255).optional(),
            cpf: vine.string().trim().optional(),
            cnpj: vine.string().trim().optional(),
            email: vine.string().trim().email().optional(),
            phone: vine.string().trim().optional(),
          })
          .optional(),
        reu: vine
          .object({
            name: vine.string().trim().maxLength(255).optional(),
            cpf: vine.string().trim().optional(),
            cnpj: vine.string().trim().optional(),
            email: vine.string().trim().email().optional(),
            phone: vine.string().trim().optional(),
          })
          .optional(),
        outros: vine
          .array(
            vine.object({
              tipo: vine.string().trim().maxLength(100).optional(),
              name: vine.string().trim().maxLength(255).optional(),
              cpf: vine.string().trim().optional(),
              cnpj: vine.string().trim().optional(),
            })
          )
          .optional(),
      })
      .nullable()
      .optional(),

    // Case value (in BRL)
    case_value: vine.number().min(0).decimal([0, 2]).nullable().optional(),
  })
)

/**
 * Validator for updating an existing case
 * All fields are optional for PATCH updates
 */
export const updateCaseValidator = vine.compile(
  vine.object({
    // Client relationship
    client_id: vine.number().min(1).optional(),

    // Case identification
    case_number: vine.string().trim().regex(cnjRegex).maxLength(50).nullable().optional(),
    internal_number: vine.string().trim().minLength(1).maxLength(50).nullable().optional(),

    // Classification
    case_type: vine
      .enum(['civil', 'criminal', 'labor', 'family', 'tax', 'administrative', 'other'])
      .optional(),
    court: vine.string().trim().maxLength(100).nullable().optional(),
    court_instance: vine.string().trim().maxLength(50).nullable().optional(),

    // Status
    status: vine.enum(['active', 'closed', 'archived', 'suspended']).optional(),
    priority: vine.enum(['low', 'medium', 'high', 'urgent']).optional(),

    // Team
    responsible_lawyer_id: vine.number().min(1).optional(),
    team_members: vine.array(vine.number().min(1)).nullable().optional(),

    // Dates
    filed_at: vine
      .date({ formats: ['YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss'] })
      .nullable()
      .optional(),
    closed_at: vine
      .date({ formats: ['YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss'] })
      .nullable()
      .optional(),

    // Additional data
    tags: vine.array(vine.string().trim().maxLength(50)).nullable().optional(),
    description: vine.string().trim().maxLength(5000).nullable().optional(),
    custom_fields: vine.record(vine.any()).nullable().optional(),

    // Parties (JSONB)
    parties: vine
      .object({
        autor: vine
          .object({
            name: vine.string().trim().maxLength(255).optional(),
            cpf: vine.string().trim().optional(),
            cnpj: vine.string().trim().optional(),
            email: vine.string().trim().email().optional(),
            phone: vine.string().trim().optional(),
          })
          .optional(),
        reu: vine
          .object({
            name: vine.string().trim().maxLength(255).optional(),
            cpf: vine.string().trim().optional(),
            cnpj: vine.string().trim().optional(),
            email: vine.string().trim().email().optional(),
            phone: vine.string().trim().optional(),
          })
          .optional(),
        outros: vine
          .array(
            vine.object({
              tipo: vine.string().trim().maxLength(100).optional(),
              name: vine.string().trim().maxLength(255).optional(),
              cpf: vine.string().trim().optional(),
              cnpj: vine.string().trim().optional(),
            })
          )
          .optional(),
      })
      .nullable()
      .optional(),

    // Case value (in BRL)
    case_value: vine.number().min(0).decimal([0, 2]).nullable().optional(),
  })
)

/**
 * Validator for case search/filter query parameters
 */
export const caseFilterValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    per_page: vine.number().min(1).max(100).optional(),
    search: vine.string().trim().minLength(1).maxLength(255).optional(),
    client_id: vine.number().min(1).optional(),
    status: vine.enum(['active', 'closed', 'archived', 'suspended']).optional(),
    priority: vine.enum(['low', 'medium', 'high', 'urgent']).optional(),
    case_type: vine
      .enum(['civil', 'criminal', 'labor', 'family', 'tax', 'administrative', 'other'])
      .optional(),
    responsible_lawyer_id: vine.number().min(1).optional(),
    court: vine.string().trim().maxLength(100).optional(),
    filed_after: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    filed_before: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    with_client: vine.boolean().optional(),
    with_deadlines: vine.boolean().optional(),
    with_documents: vine.boolean().optional(),
    with_events: vine.boolean().optional(),
  })
)

/**
 * Validator for archiving a case
 */
export const archiveCaseValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(10).maxLength(500).nullable().optional(),
  })
)
