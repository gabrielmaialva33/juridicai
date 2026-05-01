import { test } from '@japa/runner'
import { normalizeCnj } from '#modules/siop/parsers/cnj_parser'
import { normalizeDebtorName } from '#modules/siop/parsers/debtor_normalizer'
import { parseBrazilianDecimal, parseBrazilianMoney } from '#modules/siop/parsers/value_parser'
import siopNormalizeService from '#modules/siop/services/siop_normalize_service'

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
    assert.equal(parseBrazilianMoney('401540,95'), '401540.95')
    assert.isNull(parseBrazilianMoney(null))
    assert.isNull(parseBrazilianMoney(''))
    assert.isNull(parseBrazilianMoney('sem valor'))
    assert.isNull(parseBrazilianMoney('1,234.56'))
  })

  test('parses high precision Brazilian decimals', ({ assert }) => {
    assert.equal(parseBrazilianDecimal('1,0315237099479411'), '1.0315237099479411')
    assert.equal(parseBrazilianDecimal('1.234,5678'), '1234.5678')
    assert.isNull(parseBrazilianDecimal('1,234.56'))
  })
})

test.group('SIOP normalizer / official open-data rows', () => {
  test('maps real SIOP open-data CSV headers into canonical fields', ({ assert }) => {
    const normalized = siopNormalizeService.normalizeRow({
      chave: '1116122',
      exercicio: '2024',
      codigo_do_tribunal: '12105',
      nome_do_tribunal: 'Tribunal Regional Federal da 4a. Região',
      tipo_de_despesa: '12',
      nome_da_uo_executada: 'Fundo do Regime Geral de Previdência Social',
      natureza_de_despesa: '33909100',
      tipo_de_causa: 'Aposentadoria por Tempo de Contribuição (Art. 55/6)',
      valor_original_do_precatorio: '401540,95',
      valor_atualizado: '454035,83505015308',
      tributario: 'Não',
      fundef: 'Não Fundef',
      anos_decorridos: '10',
      class_tempo: 'De 10 até 15 anos',
      class_tribunais: 'Justiça Federal',
      datainicio: '2025-04-01 00:00:00,000',
      datafim: '2026-02-01 00:00:00,000',
      indiceatualizacao: '1,0315237099479411',
      data_de_ajuizamento_da_acao_originaria: '2014-07-28 00:00:00,000',
      data_da_autuacao: '2024-08-07 00:00:00,000',
      faixavalor: 'Até R$ 1 milhão',
    })

    assert.isNull(normalized.cnjNumber)
    assert.equal(normalized.debtorName, 'FUNDO DO REGIME GERAL DE PREVIDENCIA SOCIAL')
    assert.equal(normalized.faceValue, '401540.95')
    assert.equal(normalized.updatedValue, '454035.83')
    assert.equal(normalized.exerciseYear, 2024)
    assert.equal(normalized.courtCode, '12105')
    assert.equal(normalized.courtName, 'Tribunal Regional Federal da 4a. Região')
    assert.equal(normalized.budgetUnitName, 'Fundo do Regime Geral de Previdência Social')
    assert.equal(normalized.natureExpenseCode, '33909100')
    assert.equal(normalized.valueRange, 'Até R$ 1 milhão')
    assert.equal(normalized.taxClaim, false)
    assert.equal(normalized.fundef, false)
    assert.equal(normalized.elapsedYears, 10)
    assert.equal(normalized.elapsedYearsClass, 'De 10 até 15 anos')
    assert.equal(normalized.courtClass, 'Justiça Federal')
    assert.equal(normalized.originFiledAt?.toISODate(), '2014-07-28')
    assert.equal(normalized.autuatedAt?.toISODate(), '2024-08-07')
    assert.equal(normalized.correctionStartedAt?.toISODate(), '2025-04-01')
    assert.equal(normalized.correctionEndedAt?.toISODate(), '2026-02-01')
    assert.equal(normalized.correctionIndex, '1.0315237099479411')
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
