import { normalizeCnj } from '#modules/siop/parsers/cnj_parser'
import { normalizeDebtorName } from '#modules/siop/parsers/debtor_normalizer'
import { parseBrazilianMoney } from '#modules/siop/parsers/value_parser'

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
      expenseType: stringOrNull(firstValue(row, ['tipo_de_despesa'])),
      causeType: stringOrNull(firstValue(row, ['tipo_de_causa'])),
      budgetUnitCode: stringOrNull(firstValue(row, ['codigo_da_uo_executada'])),
      budgetUnitName: stringOrNull(firstValue(row, ['nome_da_uo_executada'])),
      natureExpenseCode: stringOrNull(firstValue(row, ['natureza_de_despesa'])),
      valueRange: stringOrNull(firstValue(row, ['faixavalor', 'faixa_valor'])),
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

export default new SiopNormalizeService()
