import { sanitizeError } from '#shared/helpers/sanitize_error'

export function safeJsonView(value: unknown): unknown {
  return sanitizeError(value)
}
