const CNJ_DIGITS = /^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/

export function normalizeCnj(input: string | null | undefined) {
  if (!input?.trim()) return null

  const digits = input.replace(/\D/g, '')
  const match = digits.match(CNJ_DIGITS)
  if (!match) return null

  const [, sequence, checkDigits, year, segment, court, origin] = match
  if (checkDigits !== calculateCheckDigits(sequence, year, segment, court, origin)) {
    return null
  }

  return `${match[1]}-${match[2]}.${match[3]}.${match[4]}.${match[5]}.${match[6]}`
}

function calculateCheckDigits(
  sequence: string,
  year: string,
  segment: string,
  court: string,
  origin: string
) {
  const baseNumber = `${sequence}${year}${segment}${court}${origin}`
  return String(98 - modulo97(`${baseNumber}00`)).padStart(2, '0')
}

function modulo97(value: string) {
  let remainder = 0

  for (const digit of value) {
    remainder = (remainder * 10 + Number(digit)) % 97
  }

  return remainder
}
