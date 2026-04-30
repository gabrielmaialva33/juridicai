export function normalizeDebtorName(input: string | null | undefined) {
  if (!input?.trim()) return null

  const normalized = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()

  return normalized || null
}
