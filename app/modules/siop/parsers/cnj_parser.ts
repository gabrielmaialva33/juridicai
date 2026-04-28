const CNJ_DIGITS = /^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/

export function normalizeCnj(input: string | null | undefined) {
  if (!input) return null

  const digits = input.replace(/\D/g, '')
  const match = digits.match(CNJ_DIGITS)
  if (!match) return null

  return `${match[1]}-${match[2]}.${match[3]}.${match[4]}.${match[5]}.${match[6]}`
}
