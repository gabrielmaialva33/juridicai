export type LegalSignalPolarity = 'positive' | 'negative'

export type LegalSignalRule = {
  code: string
  polarity: LegalSignalPolarity
  confidence: number
  movementCodes?: number[]
  patterns: RegExp[]
}

export type LegalSignalMatch = {
  code: string
  polarity: LegalSignalPolarity
  confidence: number
  matchedBy: 'code' | 'text' | 'code_or_text'
}

export const LEGAL_SIGNAL_RULES: LegalSignalRule[] = [
  {
    code: 'requisition_issued',
    polarity: 'positive',
    confidence: 96,
    movementCodes: [12457],
    patterns: [/expedi[cç][aã]o\s+de\s+precat[oó]rio/i, /expedi[cç][aã]o\s+de\s+rpv/i],
  },
  {
    code: 'payment_available',
    polarity: 'positive',
    confidence: 94,
    patterns: [
      /pagamento\s+(disponibilizado|liberado|efetuado|realizado)/i,
      /dep[oó]sito\s+(disponibilizado|liberado|judicial)/i,
      /alvar[aá]\s+(expedido|liberado)/i,
    ],
  },
  {
    code: 'final_judgment',
    polarity: 'positive',
    confidence: 92,
    patterns: [/tr[aâ]nsito\s+em\s+julgado/i, /certid[aã]o\s+de\s+tr[aâ]nsito/i],
  },
  {
    code: 'calculation_homologated',
    polarity: 'positive',
    confidence: 90,
    patterns: [/c[aá]lculo.*homologad/i, /homologa[cç][aã]o.*c[aá]lculo/i],
  },
  {
    code: 'superpreference_granted',
    polarity: 'positive',
    confidence: 88,
    patterns: [/superprefer[eê]ncia/i, /prefer[eê]ncia.*idos/i, /doen[cç]a\s+grave/i],
  },
  {
    code: 'direct_agreement_opened',
    polarity: 'positive',
    confidence: 86,
    patterns: [/acordo\s+direto/i, /edital.*acordo/i, /concili[aá]rio.*precat[oó]rio/i],
  },
  {
    code: 'prior_cession_detected',
    polarity: 'negative',
    confidence: 94,
    patterns: [/cess[aã]o\s+de\s+cr[eé]dito/i, /cession[aá]rio/i, /cedente/i],
  },
  {
    code: 'lien_detected',
    polarity: 'negative',
    confidence: 90,
    patterns: [/penhora/i, /bloqueio/i, /constri[cç][aã]o/i, /indisponibilidade/i],
  },
  {
    code: 'suspension_detected',
    polarity: 'negative',
    confidence: 88,
    patterns: [/suspens[aã]o/i, /suspenso/i, /sobrestamento/i, /liminar.*suspend/i],
  },
  {
    code: 'objection_pending',
    polarity: 'negative',
    confidence: 84,
    patterns: [/impugna[cç][aã]o/i, /embargos/i, /valor\s+controvertido/i],
  },
  {
    code: 'beneficiary_inventory_pending',
    polarity: 'negative',
    confidence: 82,
    patterns: [/invent[aá]rio/i, /esp[oó]lio/i, /herdeir/i, /falecid/i],
  },
  {
    code: 'fee_dispute_detected',
    polarity: 'negative',
    confidence: 78,
    patterns: [/honor[aá]rios/i, /sucumb[eê]ncia/i, /contratuais/i],
  },
  {
    code: 'special_regime_declared',
    polarity: 'negative',
    confidence: 82,
    patterns: [/regime\s+especial/i, /morat[oó]ria/i],
  },
]

export function classifyLegalSignalText(input: {
  text: string
  movementCode?: number | null
}): LegalSignalMatch[] {
  const searchableText = normalizeSearchableText(input.text)
  const matches: LegalSignalMatch[] = []

  for (const rule of LEGAL_SIGNAL_RULES) {
    const codeMatches = rule.movementCodes?.includes(input.movementCode ?? -1) ?? false
    const textMatches = rule.patterns.some((pattern) => pattern.test(searchableText))

    if (!codeMatches && !textMatches) {
      continue
    }

    matches.push({
      code: rule.code,
      polarity: rule.polarity,
      confidence: rule.confidence,
      matchedBy: codeMatches && textMatches ? 'code_or_text' : codeMatches ? 'code' : 'text',
    })
  }

  return matches
}

export function normalizeSearchableText(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '')
}
