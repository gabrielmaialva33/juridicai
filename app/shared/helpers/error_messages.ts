const ERROR_MESSAGES: Record<string, string> = {
  E_FORBIDDEN: 'You do not have permission to perform this action.',
  E_TENANT_REQUIRED: 'A tenant context is required for this action.',
  E_VALIDATION_FAILED: 'The submitted data is invalid.',
  E_IMPORT_FAILED: 'The import could not be completed.',
  E_PII_REVEAL_DENIED: 'PII reveal was denied.',
}

export function mapCodeToMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? 'An unexpected error occurred.'
}
