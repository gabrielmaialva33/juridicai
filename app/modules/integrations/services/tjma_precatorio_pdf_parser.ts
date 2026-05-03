import { DateTime } from 'luxon'
import type { JsonRecord } from '#shared/types/model_enums'

const TJMA_ROW_PATTERN =
  /^\s*(?<queuePosition>\d+)\s+(?<cnjNumber>\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})\s+(?<nature>\S+)\s+(?<budgetYear>20\d{2})\s+(?<receivedAt>\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\s+(?<priority>.*?)\s+(?<updatedValue>-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})\s+(?<debtorName>.+?)\s*$/u

export type TjmaPrecatorioPdfContext = {
  sourceKind?: string | null
  debtorGroup?: string | null
  title?: string | null
  sourceUrl?: string | null
}

export function parseTjmaPrecatorioPdfText(
  text: string,
  context: TjmaPrecatorioPdfContext = {}
): JsonRecord[] {
  const reportUpdatedAt = parseReportUpdatedAt(text)
  const paymentRegime = inferPaymentRegime(text)
  const rows: JsonRecord[] = []

  for (const line of text.split(/\r?\n/)) {
    const row = parseTjmaLine(line, context, reportUpdatedAt, paymentRegime)

    if (row) {
      rows.push(row)
    }
  }

  return rows
}

function parseTjmaLine(
  line: string,
  context: TjmaPrecatorioPdfContext,
  reportUpdatedAt: string | null,
  paymentRegime: string | null
): JsonRecord | null {
  const match = compactText(line).match(TJMA_ROW_PATTERN)

  if (!match?.groups) {
    return null
  }

  return {
    tribunal: 'TJMA',
    fonte_tipo: context.sourceKind ?? null,
    grupo_devedor: context.debtorGroup ?? null,
    titulo_relatorio: context.title ?? null,
    data_atualizacao_relatorio: reportUpdatedAt,
    regime_pagamento_relatorio: paymentRegime,
    ordem: Number(match.groups.queuePosition),
    numero_precatorio: match.groups.cnjNumber,
    natureza: normalizeNature(match.groups.nature),
    ano_orcamento: Number(match.groups.budgetYear),
    recebido_em: parseBrazilianDateTime(match.groups.receivedAt),
    prioridade: normalizePriority(match.groups.priority),
    valor_atualizado: match.groups.updatedValue,
    ente_devedor: normalizeDebtorName(match.groups.debtorName),
    source_url: context.sourceUrl ?? null,
  }
}

function parseReportUpdatedAt(text: string) {
  const match = text.match(/Atualizada\s+at[eé]\s+(\d{2}\/\d{2}\/\d{4})/i)

  if (!match) {
    return null
  }

  const parsed = DateTime.fromFormat(match[1], 'dd/MM/yyyy')
  return parsed.isValid ? parsed.toISODate() : match[1]
}

function parseBrazilianDateTime(value: string) {
  const parsed = DateTime.fromFormat(value, 'dd/MM/yyyy HH:mm:ss', {
    zone: 'America/Sao_Paulo',
  })

  return parsed.isValid ? parsed.toISO() : value
}

function inferPaymentRegime(text: string) {
  const normalized = normalizeKey(text)

  if (normalized.includes('REGIME_ESPECIAL')) {
    return 'special'
  }

  if (normalized.includes('REGIME_GERAL')) {
    return 'general'
  }

  return null
}

function normalizeNature(value: string) {
  const text = compactText(value)
  const normalized = normalizeKey(text)

  if (normalized === 'ALIMENTAR') {
    return 'Alimentar'
  }

  if (normalized === 'COMUM') {
    return 'Comum'
  }

  return text
}

function normalizePriority(value: string) {
  const text = compactText(value)
  return text || null
}

function normalizeDebtorName(value: string) {
  return compactText(value).replace(/\s+$/, '')
}

function compactText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}
