export function positiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function boundedLimit(value: unknown, fallback = 25, max = 100) {
  return Math.min(positiveInteger(value, fallback), max)
}

export function numberOrNull(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

export function stateCodeOrNull(value: unknown) {
  const normalized = stringOrNull(value)?.toUpperCase() ?? null
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : null
}

export function enumOrNull<const Value extends string>(value: unknown, allowed: readonly Value[]) {
  return typeof value === 'string' && allowed.includes(value as Value) ? (value as Value) : null
}
