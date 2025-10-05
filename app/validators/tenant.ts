import vine from '@vinejs/vine'

/**
 * Validator for creating a new tenant
 */
export const createTenantValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(255),
    subdomain: vine
      .string()
      .trim()
      .toLowerCase()
      .minLength(3)
      .maxLength(100)
      .regex(/^[a-z0-9-]+$/),
    custom_domain: vine.string().trim().maxLength(255).optional(),
    plan: vine.enum(['free', 'starter', 'pro', 'enterprise']).optional(),
    limits: vine
      .object({
        max_users: vine.number().min(1).optional(),
        max_cases: vine.number().min(1).optional(),
        max_storage_gb: vine.number().min(1).optional(),
        max_documents: vine.number().min(1).optional(),
      })
      .optional(),
  })
)

/**
 * Validator for updating an existing tenant
 */
export const updateTenantValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(255).optional(),
    subdomain: vine
      .string()
      .trim()
      .toLowerCase()
      .minLength(3)
      .maxLength(100)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    custom_domain: vine.string().trim().maxLength(255).nullable().optional(),
    plan: vine.enum(['free', 'starter', 'pro', 'enterprise']).optional(),
    is_active: vine.boolean().optional(),
    limits: vine
      .object({
        max_users: vine.number().min(1).optional(),
        max_cases: vine.number().min(1).optional(),
        max_storage_gb: vine.number().min(1).optional(),
        max_documents: vine.number().min(1).optional(),
      })
      .optional(),
    suspended_reason: vine.string().trim().maxLength(500).nullable().optional(),
  })
)
