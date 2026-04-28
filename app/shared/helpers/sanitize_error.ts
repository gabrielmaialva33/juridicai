const SENSITIVE_KEYS = [
  'password',
  'secret',
  'token',
  'authorization',
  'cookie',
  'cpf',
  'cnpj',
  'document',
  'email',
  'phone',
  'telefone',
]

export function sanitizeError(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeError(item))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      const lowerKey = key.toLowerCase()
      const isSensitive = SENSITIVE_KEYS.some((sensitiveKey) => lowerKey.includes(sensitiveKey))
      return [key, isSensitive ? '[redacted]' : sanitizeError(entry)]
    })
  )
}
