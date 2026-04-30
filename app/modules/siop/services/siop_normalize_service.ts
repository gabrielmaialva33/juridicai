import { normalizeCnj } from '#modules/siop/parsers/cnj_parser'
import { normalizeDebtorName } from '#modules/siop/parsers/debtor_normalizer'
import { parseBrazilianMoney } from '#modules/siop/parsers/value_parser'

class SiopNormalizeService {
  normalizeRow(row: Record<string, unknown>) {
    const exerciseYear = Number(
      row.exerciseYear ?? row.exercise_year ?? row.exercicio ?? row.ano ?? ''
    )
    const rawValue = row.value ?? row.valor ?? row.face_value ?? row.valor_face ?? null

    return {
      cnjNumber: normalizeCnj(String(row.cnj ?? row.process_number ?? '')),
      debtorName: normalizeDebtorName(String(row.debtor ?? row.devedor ?? row.debtor_name ?? '')),
      faceValue: parseBrazilianMoney(rawValue as string | number | null),
      exerciseYear: Number.isInteger(exerciseYear) ? exerciseYear : null,
    }
  }
}

export default new SiopNormalizeService()
