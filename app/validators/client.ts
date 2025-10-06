import vine from '@vinejs/vine'

/**
 * Validator for creating a new client
 */
export const createClientValidator = vine.compile(
  vine.object({
    client_type: vine.enum(['individual', 'company']),

    // Individual person fields (required if client_type === 'individual')
    full_name: vine.string().trim().minLength(3).maxLength(255).optional(),
    cpf: vine
      .string()
      .trim()
      .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)
      .optional()
      .requiredIfExists('full_name'),

    // Company fields (required if client_type === 'company')
    company_name: vine.string().trim().minLength(3).maxLength(255).optional(),
    cnpj: vine
      .string()
      .trim()
      .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/)
      .optional()
      .requiredIfExists('company_name'),

    // Common fields
    email: vine.string().trim().email().maxLength(255).nullable().optional(),
    phone: vine
      .string()
      .trim()
      .regex(/^[\d\s()+-]+$/)
      .minLength(8)
      .maxLength(20)
      .nullable()
      .optional(),

    // Address (JSONB)
    address: vine
      .object({
        street: vine.string().trim().maxLength(255).optional(),
        number: vine.string().trim().maxLength(20).optional(),
        complement: vine.string().trim().maxLength(100).optional(),
        neighborhood: vine.string().trim().maxLength(100).optional(),
        city: vine.string().trim().maxLength(100).optional(),
        state: vine.string().trim().minLength(2).maxLength(2).optional(), // SP, RJ, etc
        zip_code: vine
          .string()
          .trim()
          .regex(/^\d{5}-\d{3}$/)
          .optional(), // 00000-000
        country: vine.string().trim().maxLength(100).optional(),
      })
      .nullable()
      .optional(),

    // Tags (array)
    tags: vine.array(vine.string().trim().maxLength(50)).nullable().optional(),

    // Status
    is_active: vine.boolean().optional(),

    // Custom fields (JSONB)
    custom_fields: vine.record(vine.any()).nullable().optional(),

    // Internal notes
    notes: vine.string().trim().maxLength(5000).nullable().optional(),
  })
)

/**
 * Validator for updating an existing client
 * All fields are optional for PATCH updates
 */
export const updateClientValidator = vine.compile(
  vine.object({
    client_type: vine.enum(['individual', 'company']).optional(),

    // Individual person fields
    full_name: vine.string().trim().minLength(3).maxLength(255).nullable().optional(),
    cpf: vine
      .string()
      .trim()
      .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)
      .nullable()
      .optional(),

    // Company fields
    company_name: vine.string().trim().minLength(3).maxLength(255).nullable().optional(),
    cnpj: vine
      .string()
      .trim()
      .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/)
      .nullable()
      .optional(),

    // Common fields
    email: vine.string().trim().email().maxLength(255).nullable().optional(),
    phone: vine
      .string()
      .trim()
      .regex(/^[\d\s()+-]+$/)
      .minLength(8)
      .maxLength(20)
      .nullable()
      .optional(),

    // Address (JSONB)
    address: vine
      .object({
        street: vine.string().trim().maxLength(255).optional(),
        number: vine.string().trim().maxLength(20).optional(),
        complement: vine.string().trim().maxLength(100).optional(),
        neighborhood: vine.string().trim().maxLength(100).optional(),
        city: vine.string().trim().maxLength(100).optional(),
        state: vine.string().trim().minLength(2).maxLength(2).optional(),
        zip_code: vine
          .string()
          .trim()
          .regex(/^\d{5}-\d{3}$/)
          .optional(),
        country: vine.string().trim().maxLength(100).optional(),
      })
      .nullable()
      .optional(),

    // Tags (array)
    tags: vine.array(vine.string().trim().maxLength(50)).nullable().optional(),

    // Status
    is_active: vine.boolean().optional(),

    // Custom fields (JSONB)
    custom_fields: vine.record(vine.any()).nullable().optional(),

    // Internal notes
    notes: vine.string().trim().maxLength(5000).nullable().optional(),
  })
)

/**
 * Validator for client search/filter query parameters
 */
export const clientFilterValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    per_page: vine.number().min(1).max(100).optional(),
    search: vine.string().trim().minLength(1).maxLength(255).optional(),
    client_type: vine.enum(['individual', 'company']).optional(),
    is_active: vine.boolean().optional(),
    state: vine.string().trim().minLength(2).maxLength(2).optional(),
    city: vine.string().trim().maxLength(100).optional(),
    tags: vine.array(vine.string().trim().maxLength(50)).optional(),
    with_cases: vine.boolean().optional(),
    with_cases_count: vine.boolean().optional(),
    with_active_cases: vine.boolean().optional(),
    without_cases: vine.boolean().optional(),
  })
)
