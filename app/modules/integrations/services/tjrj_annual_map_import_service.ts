import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import DebtorPaymentStat from '#modules/debtors/models/debtor_payment_stat'
import Debtor from '#modules/debtors/models/debtor'
import referenceCatalogService from '#modules/reference/services/reference_catalog_service'
import tribunalDocumentExtractionService from '#modules/integrations/services/tribunal_document_extraction_service'
import SourceRecord from '#modules/siop/models/source_record'
import { normalizeDebtorName } from '#modules/siop/parsers/debtor_normalizer'
import { parseBrazilianMoney } from '#modules/siop/parsers/value_parser'
import type { DebtorType, JsonRecord, PaymentRegime } from '#shared/types/model_enums'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export type TjrjAnnualMapImportOptions = {
  maxRows?: number | null
  pdfTextExtractor?: (filePath: string) => Promise<string>
}

export type TjrjAnnualMapImportStats = {
  totalRows: number
  validRows: number
  selectedRows: number
  inserted: number
  updated: number
  skipped: number
  errors: number
}

export type TjrjAnnualMapRow = {
  tribunalAlias: string
  referenceYear: number
  debtorSphere: 'F' | 'E' | 'M'
  stateCode: string | null
  municipalityIbgeCode: string | null
  paymentRegimeCode: 'C' | 'E'
  entityTypeCode: 'D' | 'I'
  cnpj: string | null
  debtorName: string
  previousYearsIssuedAmount: string | null
  paidAmount: string | null
  debtStockAfterPayment: string | null
  currentYearIssuedAmount: string | null
  rowFingerprint: string
  rawData: JsonRecord
}

class TjrjAnnualMapImportService {
  async importSourceRecord(sourceRecordId: string, options: TjrjAnnualMapImportOptions = {}) {
    const sourceRecord = await SourceRecord.findOrFail(sourceRecordId)
    const extraction = await tribunalDocumentExtractionService.extractSourceRecord(
      sourceRecord.id,
      {
        pdfTextExtractor: options.pdfTextExtractor,
        annotateSourceRecord: true,
      }
    )
    const rows = extraction.text ? parseTjrjAnnualMapRows(extraction.text) : []
    const selectedRows = limitRows(rows, options.maxRows)
    const context = await this.buildContext()
    const stats: TjrjAnnualMapImportStats = {
      totalRows: rows.length,
      validRows: rows.length,
      selectedRows: selectedRows.length,
      inserted: 0,
      updated: 0,
      skipped: extraction.text ? 0 : 1,
      errors: 0,
    }

    for (const row of selectedRows) {
      try {
        await db.transaction(async (trx) => {
          const result = await this.upsertRow(sourceRecord, row, context.courtId, trx)
          stats[result] += 1
        })
      } catch {
        stats.errors += 1
      }
    }

    return {
      sourceRecord,
      extraction,
      stats,
    }
  }

  private async buildContext() {
    const court = await referenceCatalogService.court({
      code: 'TJRJ',
      alias: 'tjrj',
      name: 'Tribunal de Justiça do Estado do Rio de Janeiro',
    })

    return {
      courtId: court?.id ?? null,
    }
  }

  private async upsertRow(
    sourceRecord: SourceRecord,
    row: TjrjAnnualMapRow,
    courtId: string | null,
    trx: TransactionClientContract
  ) {
    const debtor = await this.findOrCreateDebtor(sourceRecord, row, trx)
    const source = `tjrj_annual_map:${row.referenceYear}`
    const existing = await DebtorPaymentStat.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('debtor_id', debtor.id)
      .where('source', source)
      .first()
    const payload = {
      tenantId: sourceRecord.tenantId,
      debtorId: debtor.id,
      periodStart: DateTime.fromObject({ year: row.referenceYear, month: 1, day: 1 }),
      periodEnd: DateTime.fromObject({ year: row.referenceYear, month: 12, day: 31 }),
      sampleSize: 1,
      averagePaymentMonths: null,
      onTimePaymentRate: null,
      paidVolume: row.paidAmount,
      openDebtStock: openDebtStock(row),
      rclDebtRatio: null,
      regimeSpecialActive: row.paymentRegimeCode === 'E',
      recentDefault: false,
      reliabilityScore: reliabilityScoreFor(row),
      source,
      rawData: {
        providerId: 'tjrj-annual-precatorio-map',
        sourceRecordId: sourceRecord.id,
        sourceUrl: sourceRecord.sourceUrl,
        courtAlias: 'tjrj',
        courtId,
        ...row.rawData,
      },
      computedAt: DateTime.now(),
    }

    debtor.useTransaction(trx)
    debtor.merge({
      name: row.debtorName,
      normalizedName: normalizeDebtorName(row.debtorName) ?? normalizeKey(row.debtorName),
      debtStockEstimate: payload.openDebtStock,
      paymentReliabilityScore: payload.reliabilityScore,
      paymentRegime: row.paymentRegimeCode === 'E' ? 'special' : 'other',
    })
    await debtor.save()

    if (existing) {
      existing.useTransaction(trx)
      existing.merge(payload)
      await existing.save()
      return 'updated' as const
    }

    await DebtorPaymentStat.create(payload, { client: trx })
    return 'inserted' as const
  }

  private async findOrCreateDebtor(
    sourceRecord: SourceRecord,
    row: TjrjAnnualMapRow,
    trx: TransactionClientContract
  ) {
    const profile = debtorProfileFor(row)
    const query = Debtor.query({ client: trx }).where('tenant_id', sourceRecord.tenantId)

    if (profile.cnpj) {
      query.where('debtor_type', profile.debtorType).where('cnpj', profile.cnpj)
    } else {
      query
        .where('debtor_type', profile.debtorType)
        .where('state_code', profile.stateCode)
        .where('normalized_key', profile.normalizedKey)
    }

    const existing = await query.first()

    if (existing) {
      return existing
    }

    return Debtor.create(
      {
        tenantId: sourceRecord.tenantId,
        name: profile.name,
        normalizedName: profile.normalizedKey,
        normalizedKey: profile.normalizedKey,
        debtorType: profile.debtorType,
        cnpj: profile.cnpj,
        stateCode: profile.stateCode,
        paymentRegime: profile.paymentRegime,
        debtStockEstimate: openDebtStock(row),
        paymentReliabilityScore: reliabilityScoreFor(row),
      },
      { client: trx }
    )
  }
}

export function parseTjrjAnnualMapRows(text: string): TjrjAnnualMapRow[] {
  const rows: TjrjAnnualMapRow[] = []
  let pendingNameLines: string[] = []

  for (const rawLine of text.split(/\r?\n/)) {
    const line = compactText(rawLine)

    if (!line || isNoiseLine(line)) {
      continue
    }

    if (!line.startsWith('TJRJ ')) {
      if (looksLikeNameContinuation(line)) {
        if (rows.length > 0 && shouldAppendToPreviousRow(rows[rows.length - 1])) {
          appendDebtorName(rows[rows.length - 1], line)
        } else {
          pendingNameLines.push(line)
          pendingNameLines = pendingNameLines.slice(-3)
        }
      }
      continue
    }

    const row = parseTjrjAnnualMapLine(line, pendingNameLines)
    pendingNameLines = []

    if (row) {
      rows.push(row)
    }
  }

  return rows
}

function parseTjrjAnnualMapLine(line: string, pendingNameLines: string[]): TjrjAnnualMapRow | null {
  const moneyMatches = [...line.matchAll(/R\$\s*(?:[\d.]+,\d{2}|-)/g)]

  if (moneyMatches.length < 4 || moneyMatches[0].index === undefined) {
    return null
  }

  const identity = line.slice(0, moneyMatches[0].index).trim()
  const tokens = identity.split(/\s+/)

  if (tokens[0] !== 'TJRJ') {
    return null
  }

  const referenceYear = numberField(tokens[1])
  const debtorSphere = tokens[2] as TjrjAnnualMapRow['debtorSphere']

  if (!referenceYear || !['F', 'E', 'M'].includes(debtorSphere)) {
    return null
  }

  let cursor = 3
  let stateCode: string | null = null
  let municipalityIbgeCode: string | null = null

  if (tokens[cursor]?.match(/^[A-Z]{2}$/)) {
    stateCode = tokens[cursor]
    cursor += 1
  }

  if (tokens[cursor]?.match(/^\d{7}$/)) {
    municipalityIbgeCode = tokens[cursor]
    cursor += 1
  }

  const paymentRegimeCode = tokens[cursor] as TjrjAnnualMapRow['paymentRegimeCode']
  const entityTypeCode = tokens[cursor + 1] as TjrjAnnualMapRow['entityTypeCode']
  cursor += 2

  if (!['C', 'E'].includes(paymentRegimeCode) || !['D', 'I'].includes(entityTypeCode)) {
    return null
  }

  let cnpj: string | null = null
  if (tokens[cursor]?.match(/^\d{14}$/)) {
    cnpj = tokens[cursor]
    cursor += 1
  }

  const inlineName = tokens.slice(cursor).join(' ')
  const debtorName = debtorNameFor({
    debtorSphere,
    stateCode,
    municipalityIbgeCode,
    cnpj,
    value: compactText([...pendingNameLines, inlineName].filter(Boolean).join(' ')),
  })
  const moneyValues = moneyMatches.slice(0, 4).map((match) => moneyField(match[0]))
  const rawData = {
    tribunalAlias: 'tjrj',
    referenceYear,
    debtorSphere,
    stateCode,
    municipalityIbgeCode,
    paymentRegimeCode,
    entityTypeCode,
    cnpj,
    debtorName,
    previousYearsIssuedAmount: moneyValues[0],
    paidAmount: moneyValues[1],
    debtStockAfterPayment: moneyValues[2],
    currentYearIssuedAmount: moneyValues[3],
    rawLine: line,
    pendingNameLines,
  } satisfies JsonRecord

  return {
    tribunalAlias: 'tjrj',
    referenceYear,
    debtorSphere,
    stateCode,
    municipalityIbgeCode,
    paymentRegimeCode,
    entityTypeCode,
    cnpj,
    debtorName,
    previousYearsIssuedAmount: moneyValues[0],
    paidAmount: moneyValues[1],
    debtStockAfterPayment: moneyValues[2],
    currentYearIssuedAmount: moneyValues[3],
    rowFingerprint: stableHash(rawData),
    rawData,
  }
}

function debtorProfileFor(row: TjrjAnnualMapRow): {
  name: string
  normalizedKey: string
  debtorType: DebtorType
  cnpj: string | null
  stateCode: string
  paymentRegime: PaymentRegime
} {
  const name = row.debtorName
  const normalizedKey = normalizeDebtorName(name) ?? normalizeKey(name)
  const stateCode = row.stateCode ?? 'RJ'

  if (row.debtorSphere === 'F') {
    return {
      name,
      normalizedKey,
      debtorType: row.entityTypeCode === 'D' ? 'union' : 'autarchy',
      cnpj: row.cnpj,
      stateCode: 'BR',
      paymentRegime: 'federal_unique',
    }
  }

  if (row.debtorSphere === 'E' && row.entityTypeCode === 'D') {
    return {
      name,
      normalizedKey,
      debtorType: 'state',
      cnpj: row.cnpj,
      stateCode,
      paymentRegime: row.paymentRegimeCode === 'E' ? 'special' : 'other',
    }
  }

  if (row.debtorSphere === 'M' && row.entityTypeCode === 'D') {
    return {
      name,
      normalizedKey,
      debtorType: 'municipality',
      cnpj: row.cnpj,
      stateCode,
      paymentRegime: row.paymentRegimeCode === 'E' ? 'special' : 'other',
    }
  }

  return {
    name,
    normalizedKey,
    debtorType: name.toUpperCase().includes('FUNDA') ? 'foundation' : 'autarchy',
    cnpj: row.cnpj,
    stateCode,
    paymentRegime: row.paymentRegimeCode === 'E' ? 'special' : 'other',
  }
}

function debtorNameFor(input: {
  debtorSphere: TjrjAnnualMapRow['debtorSphere']
  stateCode: string | null
  municipalityIbgeCode: string | null
  cnpj: string | null
  value: string
}) {
  if (input.value) {
    return input.value
  }

  if (input.debtorSphere === 'F') {
    return input.cnpj ? `Federal entity ${input.cnpj}` : 'União Federal'
  }

  if (input.debtorSphere === 'E') {
    return input.cnpj ? `State entity ${input.cnpj}` : `Estado do ${input.stateCode ?? 'RJ'}`
  }

  return input.municipalityIbgeCode
    ? `Municipality IBGE ${input.municipalityIbgeCode} - ${input.stateCode ?? 'RJ'}`
    : `Municipality debtor - ${input.stateCode ?? 'RJ'}`
}

function openDebtStock(row: TjrjAnnualMapRow) {
  return addMoney(row.debtStockAfterPayment, row.currentYearIssuedAmount)
}

function reliabilityScoreFor(row: TjrjAnnualMapRow) {
  const paid = moneyToNumber(row.paidAmount)
  const due =
    moneyToNumber(row.previousYearsIssuedAmount) + moneyToNumber(row.currentYearIssuedAmount)
  const paidRatio = due > 0 ? Math.min(paid / due, 1) : 0
  const base = row.paymentRegimeCode === 'C' ? 68 : 45
  const score = Math.round(base + paidRatio * 25)

  return Math.max(5, Math.min(score, 95))
}

function shouldAppendToPreviousRow(row: TjrjAnnualMapRow) {
  return row.entityTypeCode === 'I' && Boolean(row.cnpj)
}

function appendDebtorName(row: TjrjAnnualMapRow, value: string) {
  row.debtorName = compactText(`${row.debtorName} ${value}`)
  row.rawData.debtorName = row.debtorName
}

function isNoiseLine(line: string) {
  const normalized = normalizeText(line).toLowerCase()

  return (
    normalized.includes('tribunal de justica do estado do rio de janeiro') ||
    normalized.includes('departamento de precatorios judiciais') ||
    normalized.includes('mapa anual de precatorios') ||
    normalized.includes('sigla do tribunal') ||
    normalized.includes('ano de referencia') ||
    normalized.includes('pagina ') ||
    normalized.includes('orcamento do ano') ||
    normalized.includes('montante dos precatorios') ||
    normalized.includes('saldo devedor apos')
  )
}

function looksLikeNameContinuation(line: string) {
  return /[A-Za-zÀ-ÿ]/.test(line) && !line.includes('R$')
}

function moneyField(value: string | null | undefined) {
  if (!value || value.replace(/^R\$\s*/i, '').trim() === '-') {
    return null
  }

  return parseBrazilianMoney(value)
}

function addMoney(left: string | null, right: string | null) {
  const total = moneyToNumber(left) + moneyToNumber(right)
  return total > 0 ? total.toFixed(2) : null
}

function moneyToNumber(value: string | null) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function limitRows<T>(rows: T[], limit?: number | null) {
  if (!limit || limit < 1) {
    return rows
  }

  return rows.slice(0, Math.trunc(limit))
}

function numberField(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null
  if (typeof value !== 'string') return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeKey(value: string) {
  return normalizeText(value)
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function compactText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function stableHash(value: JsonRecord) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export default new TjrjAnnualMapImportService()
