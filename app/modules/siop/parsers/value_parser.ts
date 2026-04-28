export function parseBrazilianMoney(input: string | number | null | undefined) {
  if (input === null || input === undefined || input === '') return null
  if (typeof input === 'number') return Number.isFinite(input) ? input : null

  const normalized = input.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const value = Number(normalized)

  return Number.isFinite(value) ? value : null
}
