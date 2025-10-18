import vine from '@vinejs/vine'

/**
 * Validator for Google Sign In with Firebase
 */
export const googleSignInValidator = vine.compile(
  vine.object({
    idToken: vine.string().trim(),
    tenantId: vine.string().uuid().optional(),
  })
)
