import { DateTime } from 'luxon'
import { normalizeCnj } from '#modules/siop/parsers/cnj_parser'
import { normalizeDebtorName } from '#modules/siop/parsers/debtor_normalizer'
import { parseBrazilianDecimal, parseBrazilianMoney } from '#modules/siop/parsers/value_parser'

class SiopNormalizeService {
  normalizeRow(row: Record<string, unknown>) {
    const exerciseYear = Number(
      row.exerciseYear ?? row.exercise_year ?? row.exercicio ?? row.exercicio_ano ?? row.ano ?? ''
    )
    const rawValue = firstValue(row, [
      'valor_original_do_precatorio',
      'valor_atualizado',
      'value',
      'valor',
      'face_value',
      'valor_face',
    ])
    const debtorName = firstValue(row, [
      'nome_da_uo_executada',
      'uo_executada',
      'devedor',
      'debtor',
      'debtor_name',
    ])
    const cnjNumber = firstValue(row, [
      'cnj',
      'process_number',
      'numero_processo',
      'processo',
      'processo_originario',
    ])

    return {
      cnjNumber: normalizeCnj(String(cnjNumber ?? '')),
      debtorName: normalizeDebtorName(String(debtorName ?? '')),
      faceValue: parseBrazilianMoney(rawValue as string | number | null),
      updatedValue: parseBrazilianMoney(
        firstValue(row, ['valor_atualizado', 'estimated_updated_value']) as string | number | null
      ),
      exerciseYear: Number.isInteger(exerciseYear) ? exerciseYear : null,
      courtCode: stringOrNull(firstValue(row, ['codigo_do_tribunal'])),
      courtName: stringOrNull(firstValue(row, ['nome_do_tribunal', 'tribunal_expedidor'])),
      courtClass: stringOrNull(firstValue(row, ['class_tribunais', 'classe_tribunal'])),
      expenseType: stringOrNull(firstValue(row, ['tipo_de_despesa'])),
      causeType: stringOrNull(firstValue(row, ['tipo_de_causa'])),
      budgetUnitCode: stringOrNull(firstValue(row, ['codigo_da_uo_executada'])),
      budgetUnitName: stringOrNull(firstValue(row, ['nome_da_uo_executada'])),
      natureExpenseCode: stringOrNull(firstValue(row, ['natureza_de_despesa'])),
      valueRange: stringOrNull(firstValue(row, ['faixavalor', 'faixa_valor'])),
      taxClaim: booleanOrNull(firstValue(row, ['tributario', 'tributário'])),
      fundef: fundefOrNull(firstValue(row, ['fundef'])),
      elapsedYears: integerOrNull(firstValue(row, ['anos_decorridos'])),
      elapsedYearsClass: stringOrNull(firstValue(row, ['class_tempo'])),
      originFiledAt: parseSiopDate(firstValue(row, ['data_de_ajuizamento_da_acao_originaria'])),
      autuatedAt: parseSiopDate(firstValue(row, ['data_da_autuacao', 'data_da_autuação'])),
      correctionStartedAt: parseSiopDate(firstValue(row, ['datainicio', 'data_inicio'])),
      correctionEndedAt: parseSiopDate(firstValue(row, ['datafim', 'data_fim'])),
      correctionIndex: parseBrazilianDecimal(
        firstValue(row, ['indiceatualizacao']) as string | null
      ),
    }
  }
}

function firstValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value
    }
  }

  return null
}

function stringOrNull(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  const text = String(value).trim()
  return text === '' ? null : text
}

function integerOrNull(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null
  }

  const number = Number(String(value).replace(/\D/g, ''))
  return Number.isInteger(number) ? number : null
}

function booleanOrNull(value: unknown) {
  const text = stringOrNull(value)?.toLowerCase()
  if (!text) return null
  if (['sim', 's', 'true', '1', 'yes'].includes(text)) return true
  if (['nao', 'não', 'n', 'false', '0', 'no'].includes(text)) return false
  return null
}

function fundefOrNull(value: unknown) {
  const text = stringOrNull(value)?.toLowerCase()
  if (!text) return null
  if (text.includes('não') || text.includes('nao')) return false
  if (text.includes('fundef')) return true
  return booleanOrNull(value)
}

function parseSiopDate(value: unknown) {
  const text = stringOrNull(value)
  if (!text) return null

  const isoDate = DateTime.fromISO(text.slice(0, 10), { zone: 'utc' })
  if (isoDate.isValid) return isoDate

  const brazilianDate = DateTime.fromFormat(text.slice(0, 10), 'dd/MM/yyyy', { zone: 'utc' })
  return brazilianDate.isValid ? brazilianDate : null
}

export default new SiopNormalizeService()
