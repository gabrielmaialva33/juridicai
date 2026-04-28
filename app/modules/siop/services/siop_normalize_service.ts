import { normalizeCnj } from '#modules/siop/parsers/cnj_parser'
import { normalizeDebtorName } from '#modules/siop/parsers/debtor_normalizer'
import { parseBrazilianMoney } from '#modules/siop/parsers/value_parser'

class SiopNormalizeService {
  normalizeRow(row: Record<string, unknown>) {
    return {
      cnjNumber: normalizeCnj(String(row.cnj ?? row.process_number ?? '')),
      debtorName: normalizeDebtorName(String(row.debtor ?? row.devedor ?? '')),
      faceValue: parseBrazilianMoney(row.value as string | number | null | undefined),
    }
  }
}

export default new SiopNormalizeService()
