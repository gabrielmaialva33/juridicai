export function parseBrazilianMoney(input: string | number | null | undefined) {
  if (input === null || input === undefined || input === '') return null
  if (typeof input === 'number') return Number.isFinite(input) ? input.toFixed(2) : null

  const value = input
    .trim()
    .replace(/^R\$\s*/i, '')
    .replace(/\s/g, '')
  if (!value) return null

  const match = value.match(/^(-?)(?:(\d{1,3}(?:\.\d{3})+)|(\d+))(?:,(\d+))?$/)
  if (!match) return null

  const [, sign, groupedInteger, plainInteger, cents = ''] = match
  const integer = (groupedInteger ?? plainInteger).replace(/\./g, '').replace(/^0+(?=\d)/, '')

  return `${sign}${integer || '0'}.${cents.slice(0, 2).padEnd(2, '0')}`
}
