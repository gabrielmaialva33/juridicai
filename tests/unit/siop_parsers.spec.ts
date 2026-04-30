import { test } from '@japa/runner'
import { normalizeCnj } from '#modules/siop/parsers/cnj_parser'
import { normalizeDebtorName } from '#modules/siop/parsers/debtor_normalizer'
import { parseBrazilianMoney } from '#modules/siop/parsers/value_parser'

test.group('SIOP parsers / CNJ numbers', () => {
  test('normalizes formatted and digit-only valid CNJ numbers', ({ assert }) => {
    assert.equal(normalizeCnj('0001234-94.2024.4.01.3400'), '0001234-94.2024.4.01.3400')
    assert.equal(normalizeCnj('00012349420244013400'), '0001234-94.2024.4.01.3400')
    assert.equal(normalizeCnj(' 0001234 94 2024 4 01 3400 '), '0001234-94.2024.4.01.3400')
  })

  test('rejects malformed or check-digit-invalid CNJ numbers', ({ assert }) => {
    assert.isNull(normalizeCnj(null))
    assert.isNull(normalizeCnj(''))
    assert.isNull(normalizeCnj('123'))
    assert.isNull(normalizeCnj('0001234-00.2024.4.01.3400'))
  })
})

test.group('SIOP parsers / BRL values', () => {
  test('parses Brazilian currency strings without losing cents', ({ assert }) => {
    assert.equal(parseBrazilianMoney('R$ 1.234.567,89'), '1234567.89')
    assert.equal(parseBrazilianMoney('1.234,00'), '1234.00')
    assert.equal(parseBrazilianMoney('-2.500,15'), '-2500.15')
  })

  test('parses numeric inputs and rejects ambiguous text', ({ assert }) => {
    assert.equal(parseBrazilianMoney(1250.5), '1250.50')
    assert.isNull(parseBrazilianMoney(null))
    assert.isNull(parseBrazilianMoney(''))
    assert.isNull(parseBrazilianMoney('sem valor'))
    assert.isNull(parseBrazilianMoney('1,234.56'))
  })
})

test.group('SIOP parsers / debtor names', () => {
  test('normalizes federal debtor names into stable matching keys', ({ assert }) => {
    assert.equal(
      normalizeDebtorName(' União Federal / Ministério da Saúde '),
      'UNIAO FEDERAL MINISTERIO DA SAUDE'
    )
    assert.equal(
      normalizeDebtorName('Instituto Nacional do Seguro Social - INSS'),
      'INSTITUTO NACIONAL DO SEGURO SOCIAL INSS'
    )
  })

  test('returns null for blank debtor names', ({ assert }) => {
    assert.isNull(normalizeDebtorName(null))
    assert.isNull(normalizeDebtorName('   '))
  })
})
