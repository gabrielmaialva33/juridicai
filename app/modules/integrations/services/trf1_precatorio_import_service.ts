import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import AssetBudgetFact from '#modules/precatorios/models/asset_budget_fact'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import Debtor from '#modules/debtors/models/debtor'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import referenceCatalogService from '#modules/reference/services/reference_catalog_service'
import sourceEvidenceService from '#modules/integrations/services/source_evidence_service'
import tribunalDocumentExtractionService, {
  type TribunalExtractedRow,
} from '#modules/integrations/services/tribunal_document_extraction_service'
import SourceRecord from '#modules/siop/models/source_record'
import { normalizeCnj } from '#modules/siop/parsers/cnj_parser'
import { normalizeDebtorName } from '#modules/siop/parsers/debtor_normalizer'
import { parseBrazilianMoney } from '#modules/siop/parsers/value_parser'
import type { AssetNature, DebtorType, JsonRecord, PaymentRegime } from '#shared/types/model_enums'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export type Trf1PrecatorioImportOptions = {
  maxRows?: number | null
  chunkSize?: number | null
  pdfTextExtractor?: (filePath: string) => Promise<string>
}

export type Trf1PrecatorioImportStats = {
  totalRows: number
  validRows: number
  selectedRows: number
  inserted: number
  updated: number
  skipped: number
  errors: number
}

type Trf1ImportRow = {
  row: TribunalExtractedRow
  order: number | null
  proposalYear: number | null
  processNumber: string
  cnjNumber: string | null
  originProcessNumber: string | null
  requisitionNumber: string | null
  debtorName: string | null
  nature: AssetNature
  value: string | null
  filedAt: DateTime | null
  budgetUnitName: string | null
  expenseType: string | null
  causeType: string | null
  rawData: JsonRecord
}

type ImportContext = {
  courtId: string | null
  judicialClassId: string | null
}

class Trf1PrecatorioImportService {
  async importSourceRecord(sourceRecordId: string, options: Trf1PrecatorioImportOptions = {}) {
    const sourceRecord = await SourceRecord.findOrFail(sourceRecordId)
    const extraction = await tribunalDocumentExtractionService.extractSourceRecord(
      sourceRecord.id,
      {
        pdfTextExtractor: options.pdfTextExtractor,
        annotateSourceRecord: true,
      }
    )
    const extractedRows = await rowsForImport(sourceRecord, extraction.rows, extraction.format)
    const rows = extractedRows.map((row) => normalizeRow(sourceRecord, row))
    const validRows = rows.filter((row): row is Trf1ImportRow => Boolean(row))
    const selectedRows = limitRows(validRows, options.maxRows)
    const chunkSize = normalizeChunkSize(options.chunkSize)
    const batches = chunkRows(selectedRows, chunkSize)
    const context = await this.buildContext()
    const stats: Trf1PrecatorioImportStats = {
      totalRows: extractedRows.length,
      validRows: validRows.length,
      selectedRows: selectedRows.length,
      inserted: 0,
      updated: 0,
      skipped: extractedRows.length - validRows.length,
      errors: 0,
    }

    for (const batch of batches) {
      for (const row of batch) {
        try {
          await db.transaction(async (trx) => {
            const result = await this.upsertRow(sourceRecord, row, context, trx)
            stats[result] += 1
          })
        } catch {
          stats.errors += 1
        }
      }
    }

    return {
      sourceRecord,
      extraction,
      stats,
      chunking: {
        availableRows: validRows.length,
        selectedRows: selectedRows.length,
        chunkSize,
        processedBatches: batches.length,
      },
    }
  }

  private async buildContext(): Promise<ImportContext> {
    const court = await referenceCatalogService.court({
      code: 'TRF1',
      alias: 'trf1',
      name: 'Tribunal Regional Federal da 1ª Região',
    })
    const judicialClass = await referenceCatalogService.judicialClass({
      code: 1265,
      name: 'Precatório',
    })

    return {
      courtId: court?.id ?? null,
      judicialClassId: judicialClass?.id ?? null,
    }
  }

  private async upsertRow(
    sourceRecord: SourceRecord,
    row: Trf1ImportRow,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
    const debtor = await this.findOrCreateDebtor(sourceRecord, row, trx)
    const externalId = buildExternalId(sourceRecord, row)
    const existing = await PrecatorioAsset.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where((builder) => {
        if (row.cnjNumber) {
          builder.where('cnj_number', row.cnjNumber).orWhere('external_id', externalId)
          return
        }

        builder.where('external_id', externalId)
      })
      .first()
    const rawData = buildAssetRawData(sourceRecord, row)
    const payload = {
      tenantId: sourceRecord.tenantId,
      sourceRecordId: sourceRecord.id,
      source: 'tribunal' as const,
      externalId,
      cnjNumber: row.cnjNumber,
      originProcessNumber: row.originProcessNumber ?? row.cnjNumber,
      debtorId: debtor.id,
      courtId: context.courtId,
      assetNumber: row.processNumber,
      exerciseYear: row.proposalYear,
      budgetYear: row.proposalYear,
      nature: row.nature,
      lifecycleStatus: lifecycleStatusFor(sourceRecord),
      piiStatus: 'pseudonymous' as const,
      complianceStatus: 'approved_for_analysis' as const,
      rawData,
      rowFingerprint: stableHash(rawData),
    }

    if (existing) {
      existing.useTransaction(trx)
      existing.merge(payload)
      await existing.save()
      await this.upsertRelatedRecords(sourceRecord, existing, row, context, trx)
      return 'updated' as const
    }

    const asset = await PrecatorioAsset.create(payload, { client: trx })
    await this.upsertRelatedRecords(sourceRecord, asset, row, context, trx)
    return 'inserted' as const
  }

  private async findOrCreateDebtor(
    sourceRecord: SourceRecord,
    row: Trf1ImportRow,
    trx: TransactionClientContract
  ) {
    const profile = debtorProfileFor(row.debtorName, sourceRecord)
    const existing = await Debtor.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('normalized_key', profile.normalizedKey)
      .where('state_code', profile.stateCode)
      .first()

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
        cnpj: null,
        stateCode: profile.stateCode,
        paymentRegime: profile.paymentRegime,
      },
      { client: trx }
    )
  }

  private async upsertRelatedRecords(
    sourceRecord: SourceRecord,
    asset: PrecatorioAsset,
    row: Trf1ImportRow,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
    await this.upsertValuation(sourceRecord, asset.id, row, trx)
    await this.upsertBudgetFact(sourceRecord, asset.id, row, trx)
    await this.upsertJudicialProcess(sourceRecord, asset, row, context, trx)
    await this.createEvent(sourceRecord, asset.id, row, trx)
    await this.recordSourceEvidence(sourceRecord, asset, row, trx)
  }

  private async upsertValuation(
    sourceRecord: SourceRecord,
    assetId: string,
    row: Trf1ImportRow,
    trx: TransactionClientContract
  ) {
    const existing = await AssetValuation.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('asset_id', assetId)
      .where('source_record_id', sourceRecord.id)
      .whereRaw("raw_data->>'rowFingerprint' = ?", [row.row.rowFingerprint])
      .first()
    const payload = {
      tenantId: sourceRecord.tenantId,
      assetId,
      faceValue: row.value,
      estimatedUpdatedValue: row.value,
      baseDate: row.filedAt,
      queuePosition: row.order,
      sourceRecordId: sourceRecord.id,
      computedAt: DateTime.now(),
      rawData: buildAssetRawData(sourceRecord, row),
    }

    if (existing) {
      existing.useTransaction(trx)
      existing.merge(payload)
      await existing.save()
      return existing
    }

    return AssetValuation.create(payload, { client: trx })
  }

  private async upsertBudgetFact(
    sourceRecord: SourceRecord,
    assetId: string,
    row: Trf1ImportRow,
    trx: TransactionClientContract
  ) {
    const existing = await AssetBudgetFact.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('asset_id', assetId)
      .where('source_record_id', sourceRecord.id)
      .whereRaw("raw_data->>'rowFingerprint' = ?", [row.row.rowFingerprint])
      .first()
    const payload = {
      tenantId: sourceRecord.tenantId,
      assetId,
      exerciseYear: row.proposalYear,
      budgetYear: row.proposalYear,
      budgetUnitId: null,
      expenseType: row.expenseType,
      causeType: row.causeType,
      sourceRecordId: sourceRecord.id,
      rawData: buildAssetRawData(sourceRecord, row),
    }

    if (existing) {
      existing.useTransaction(trx)
      existing.merge(payload)
      await existing.save()
      return existing
    }

    return AssetBudgetFact.create(payload, { client: trx })
  }

  private async upsertJudicialProcess(
    sourceRecord: SourceRecord,
    asset: PrecatorioAsset,
    row: Trf1ImportRow,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
    if (!row.cnjNumber) {
      return null
    }

    const existing = await JudicialProcess.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('cnj_number', row.cnjNumber)
      .first()
    const payload = {
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      source: 'tribunal' as const,
      cnjNumber: row.cnjNumber,
      courtId: context.courtId,
      classId: context.judicialClassId,
      courtAlias: 'trf1',
      filedAt: row.filedAt,
      rawData: {
        providerId: 'trf1-precatorio-reports',
        courtAlias: 'trf1',
        sourceRecordId: sourceRecord.id,
        sourceKind: sourceRecord.rawData?.sourceKind ?? null,
        rowFingerprint: row.row.rowFingerprint,
        proposalYear: row.proposalYear,
      },
    }

    if (existing) {
      existing.useTransaction(trx)
      existing.merge(payload)
      await existing.save()
      return existing
    }

    return JudicialProcess.create(payload, { client: trx })
  }

  private async createEvent(
    sourceRecord: SourceRecord,
    assetId: string,
    row: Trf1ImportRow,
    trx: TransactionClientContract
  ) {
    const idempotencyKey = `trf1:${sourceRecord.id}:${row.row.rowFingerprint}`
    const existing = await AssetEvent.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('asset_id', assetId)
      .where('event_type', 'trf1_imported')
      .where('idempotency_key', idempotencyKey)
      .first()

    if (existing) {
      return existing
    }

    return AssetEvent.create(
      {
        tenantId: sourceRecord.tenantId,
        assetId,
        eventType: 'trf1_imported',
        eventDate: DateTime.now(),
        source: 'tribunal',
        payload: buildEventRawData(sourceRecord, row),
        idempotencyKey,
      },
      { client: trx }
    )
  }

  private async recordSourceEvidence(
    sourceRecord: SourceRecord,
    asset: PrecatorioAsset,
    row: Trf1ImportRow,
    trx: TransactionClientContract
  ) {
    await sourceEvidenceService.linkAsset({
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: 'trf1-precatorio-reports',
      linkType: 'primary',
      confidence: row.cnjNumber ? 1 : 0.75,
      matchReason: row.cnjNumber ? 'trf1_cnj_report_match' : 'trf1_source_row_match',
      matchedFields: {
        cnjNumber: row.cnjNumber,
        processNumber: row.processNumber,
        requisitionNumber: row.requisitionNumber,
        rowFingerprint: row.row.rowFingerprint,
      },
      normalizedPayload: {
        cnjNumber: row.cnjNumber,
        processNumber: row.processNumber,
        originProcessNumber: row.originProcessNumber,
        requisitionNumber: row.requisitionNumber,
        value: row.value,
        debtorName: row.debtorName,
        nature: row.nature,
      },
      rawPointer: {
        sourceRecordId: sourceRecord.id,
        rowNumber: row.row.rowNumber,
        rowFingerprint: row.row.rowFingerprint,
      },
      trx,
    })

    await this.upsertIdentifier(
      sourceRecord,
      asset.id,
      'precatorio_number',
      row.processNumber,
      true,
      row,
      trx
    )
    await this.upsertIdentifier(
      sourceRecord,
      asset.id,
      'requisition_number',
      row.requisitionNumber,
      false,
      row,
      trx
    )
    await this.upsertIdentifier(
      sourceRecord,
      asset.id,
      'origin_process_number',
      row.originProcessNumber,
      false,
      row,
      trx
    )
    await this.upsertIdentifier(sourceRecord, asset.id, 'cnj_number', row.cnjNumber, true, row, trx)
  }

  private async upsertIdentifier(
    sourceRecord: SourceRecord,
    assetId: string,
    identifierType:
      | 'precatorio_number'
      | 'requisition_number'
      | 'origin_process_number'
      | 'cnj_number',
    identifierValue: string | null,
    isPrimary: boolean,
    row: Trf1ImportRow,
    trx: TransactionClientContract
  ) {
    await sourceEvidenceService.upsertIdentifier({
      tenantId: sourceRecord.tenantId,
      assetId,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: 'trf1-precatorio-reports',
      identifierType,
      identifierValue,
      issuer: 'TRF1',
      isPrimary,
      rawData: buildAssetRawData(sourceRecord, row),
      trx,
    })
  }
}

function normalizeRow(sourceRecord: SourceRecord, row: TribunalExtractedRow): Trf1ImportRow | null {
  const processNumber = firstString(row.rawData, [
    'processo',
    'numero_do_processo',
    'numero_processo',
    'processo_originario',
    'processo_de_origem',
    'precatorio',
    'numero_do_precatorio',
    'prc',
    'requisicao',
    'numero_da_requisicao',
  ])
  const requisitionNumber = firstString(row.rawData, [
    'numero_requisicao',
    'numero_da_requisicao',
    'num_req',
    'requisicao',
    'prc',
  ])
  const cnjNumber = row.normalizedCnj ?? normalizeTrf1ProcessNumber(processNumber)
  const value = firstMoney(row.rawData, [
    'valor_atualizado',
    'valor_requisitado',
    'valor_do_precatorio',
    'valor_pago',
    'valor',
    'montante',
    'saldo',
  ])
  const effectiveProcessNumber =
    processNumber ?? cnjNumber ?? requisitionNumber ?? `row:${row.rowFingerprint}`

  if (!cnjNumber && !value && !processNumber && !requisitionNumber) {
    return null
  }

  return {
    row,
    order: firstNumber(row.rawData, [
      'n_ordem',
      'ordem',
      'ordem_cronologica',
      'posicao',
      'sequencial',
    ]),
    proposalYear:
      firstNumber(row.rawData, [
        'proposta',
        'exercicio',
        'ano_proposta',
        'ano_orcamento',
        'ano',
        'referencia',
      ]) ??
      row.normalizedYear ??
      numberField(sourceRecord.rawData?.year),
    processNumber: effectiveProcessNumber,
    cnjNumber,
    originProcessNumber: firstString(row.rawData, [
      'processo_originario',
      'processo_de_origem',
      'proc_orig_execucao',
      'origem',
    ]),
    requisitionNumber,
    debtorName: firstString(row.rawData, [
      'entidade_devedora',
      'ente_devedor',
      'devedor',
      'orgao_devedor',
      'unidade_orcamentaria',
      'unidade_gestora',
      'entidade',
    ]),
    nature: detectNature(
      firstString(row.rawData, ['natureza_do_credito', 'natureza_credito', 'natureza', 'tipo'])
    ),
    value,
    filedAt: parseDate(
      firstString(row.rawData, [
        'data_de_apresentacao',
        'data_apresentacao',
        'data_de_autuacao',
        'autuado_em',
        'autuacao',
        'data',
      ])
    ),
    budgetUnitName: firstString(row.rawData, [
      'unidade_orcamentaria',
      'unidade_gestora',
      'orgao_devedor',
    ]),
    expenseType: firstString(row.rawData, ['tipo_despesa', 'tipo', 'grupo_despesa']),
    causeType: firstString(row.rawData, ['assunto', 'causa', 'natureza_da_acao']),
    rawData: row.rawData,
  }
}

async function rowsForImport(
  sourceRecord: SourceRecord,
  rows: TribunalExtractedRow[],
  format: string
) {
  if (format !== 'html' || !sourceRecord.sourceFilePath) {
    return rows
  }

  const parsedRows = parseTrf1ExcelHtmlRows(decodeText(await readFile(sourceRecord.sourceFilePath)))
  return parsedRows.length ? parsedRows : rows
}

function parseTrf1ExcelHtmlRows(html: string): TribunalExtractedRow[] {
  const tableRows = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) => match[0])
  const rows: TribunalExtractedRow[] = []

  for (const tableRow of tableRows) {
    const cells = [...tableRow.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((match) => compactText(decodeHtml(stripTags(match[1]))))
      .filter((cell) => cell && cell !== '&nbsp;')

    if (cells.length < 7 || !/^\d{4}$/.test(cells[0]) || !looksLikeTrf1Process(cells[1])) {
      continue
    }

    const rawData: JsonRecord = {
      proposta: cells[0],
      precatorio: cells[1],
      natureza: cells[2] ?? null,
      preferencia: cells[3] ?? null,
      data_da_apresentacao: cells[4] ?? null,
      valor_devido: cells[5] ?? null,
      devedor: cells.slice(6).join(' '),
    }
    const normalizedCnj = normalizeTrf1ProcessNumber(cells[1])
    const normalizedValue = parseBrazilianMoney(cells[5] ?? null)
    const normalizedYear = numberField(cells[0])

    rows.push({
      rowNumber: rows.length + 1,
      rawData,
      normalizedCnj,
      normalizedValue,
      normalizedYear,
      rowFingerprint: stableHash({ rawData, normalizedCnj, normalizedValue, normalizedYear }),
    })
  }

  return rows
}

function looksLikeTrf1Process(value: string | null) {
  return Boolean(value?.match(/^\d{6,7}-\d{2}\.\d{4}\.4\.01\.\d{4}$/))
}

function normalizeTrf1ProcessNumber(value: string | null) {
  if (!value) {
    return null
  }

  const direct = normalizeCnj(value)
  if (direct) {
    return direct
  }

  const shortened = value.match(/^(\d{6})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})$/)
  if (!shortened) {
    return null
  }

  return normalizeCnj(
    `0${shortened[1]}-${shortened[2]}.${shortened[3]}.${shortened[4]}.${shortened[5]}.${shortened[6]}`
  )
}

function buildExternalId(sourceRecord: SourceRecord, row: Trf1ImportRow) {
  return [
    'trf1',
    sourceRecord.rawData?.sourceKind ?? 'precatorio_report',
    sourceRecord.rawData?.year ?? row.proposalYear ?? 'unknown',
    row.cnjNumber ?? row.processNumber,
    row.row.rowFingerprint.slice(0, 16),
  ].join(':')
}

function buildAssetRawData(sourceRecord: SourceRecord, row: Trf1ImportRow): JsonRecord {
  return {
    providerId: 'trf1-precatorio-reports',
    sourceRecordId: sourceRecord.id,
    sourceUrl: sourceRecord.sourceUrl,
    courtAlias: 'trf1',
    sourceKind: sourceRecord.rawData?.sourceKind ?? null,
    title: sourceRecord.rawData?.title ?? null,
    year: sourceRecord.rawData?.year ?? null,
    processNumber: row.processNumber,
    cnjNumber: row.cnjNumber,
    originProcessNumber: row.originProcessNumber,
    requisitionNumber: row.requisitionNumber,
    debtorName: row.debtorName,
    budgetUnitName: row.budgetUnitName,
    proposalYear: row.proposalYear,
    value: row.value,
    filedAt: row.filedAt?.toISODate() ?? null,
    nature: row.nature,
    expenseType: row.expenseType,
    causeType: row.causeType,
    rowNumber: row.row.rowNumber,
    rowFingerprint: row.row.rowFingerprint,
    rowRawData: row.rawData,
  }
}

function buildEventRawData(sourceRecord: SourceRecord, row: Trf1ImportRow): JsonRecord {
  return {
    providerId: 'trf1-precatorio-reports',
    sourceRecordId: sourceRecord.id,
    sourceKind: sourceRecord.rawData?.sourceKind ?? null,
    processNumber: row.processNumber,
    cnjNumber: row.cnjNumber,
    value: row.value,
    debtorName: row.debtorName,
    proposalYear: row.proposalYear,
    nature: row.nature,
  }
}

function debtorProfileFor(
  value: string | null,
  sourceRecord: SourceRecord
): {
  name: string
  normalizedKey: string
  debtorType: DebtorType
  stateCode: string
  paymentRegime: PaymentRegime
} {
  const fallback =
    sourceRecord.rawData?.sourceKind === 'subnational_budget_proposal' ||
    sourceRecord.rawData?.sourceKind === 'subnational_repasses' ||
    sourceRecord.rawData?.sourceKind === 'subnational_consolidated_debt' ||
    sourceRecord.rawData?.sourceKind === 'subnational_debt_map'
      ? 'Entidade estadual ou municipal não identificada - TRF1'
      : 'União Federal, autarquias e fundações - TRF1'
  const name = compactText(value ?? fallback)
  const normalizedKey = normalizeDebtorName(name) ?? normalizeKey(name)
  const stateCode = inferStateCode(name) ?? 'BR'
  const normalized = normalizedKey

  if (normalized.includes('MUNICIPIO') || normalized.includes('PREFEITURA')) {
    return {
      name,
      normalizedKey,
      debtorType: 'municipality',
      stateCode,
      paymentRegime: 'other',
    }
  }

  if (normalized.includes('ESTADO') || normalized.includes('FAZENDA')) {
    return {
      name,
      normalizedKey,
      debtorType: 'state',
      stateCode,
      paymentRegime: 'other',
    }
  }

  if (normalized.includes('UNIAO')) {
    return {
      name,
      normalizedKey,
      debtorType: 'union',
      stateCode: 'BR',
      paymentRegime: 'federal_unique',
    }
  }

  return {
    name,
    normalizedKey,
    debtorType: sourceRecord.rawData?.sourceKind?.toString().startsWith('subnational')
      ? 'municipality'
      : 'autarchy',
    stateCode,
    paymentRegime: sourceRecord.rawData?.sourceKind?.toString().startsWith('subnational')
      ? 'other'
      : 'federal_unique',
  }
}

function lifecycleStatusFor(sourceRecord: SourceRecord) {
  return sourceRecord.rawData?.sourceKind === 'subnational_repasses'
    ? ('paid' as const)
    : ('discovered' as const)
}

function detectNature(value: string | null): AssetNature {
  const normalized = normalizeText(value ?? '')

  if (normalized.includes('aliment')) {
    return 'alimentar'
  }

  if (normalized.includes('comum') || normalized.includes('nao alimentar')) {
    return 'comum'
  }

  return 'unknown'
}

function firstString(rawData: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = stringField(rawData[key])
    if (value) {
      return value
    }
  }

  for (const [key, value] of Object.entries(rawData)) {
    if (!keys.some((candidate) => key.includes(candidate))) {
      continue
    }

    const text = stringField(value)
    if (text) {
      return text
    }
  }

  return null
}

function firstMoney(rawData: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = parseBrazilianMoney(stringField(rawData[key]))
    if (value) {
      return value
    }
  }

  for (const [key, value] of Object.entries(rawData)) {
    if (!keys.some((candidate) => key.includes(candidate))) {
      continue
    }

    const parsed = parseBrazilianMoney(stringField(value))
    if (parsed) {
      return parsed
    }
  }

  return null
}

function firstNumber(rawData: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = numberField(rawData[key])
    if (value !== null) {
      return value
    }
  }

  for (const [key, value] of Object.entries(rawData)) {
    if (!keys.some((candidate) => key.includes(candidate))) {
      continue
    }

    const parsed = numberField(value)
    if (parsed !== null) {
      return parsed
    }
  }

  return null
}

function stringField(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  const text = String(value).trim()
  return text || null
}

function numberField(value: unknown) {
  const text = stringField(value)
  if (!text) {
    return null
  }

  const normalized = text.replace(/\D/g, '')
  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseDate(value: string | null) {
  if (!value) {
    return null
  }

  const formats = ['dd/MM/yyyy', 'd/M/yyyy', 'yyyy-MM-dd', "yyyy-MM-dd'T'HH:mm:ss.SSSZZ"]

  for (const format of formats) {
    const parsed = DateTime.fromFormat(value, format, { zone: 'utc' })
    if (parsed.isValid) {
      return parsed
    }
  }

  const iso = DateTime.fromISO(value, { zone: 'utc' })
  return iso.isValid ? iso : null
}

function inferStateCode(value: string) {
  const normalized = normalizeText(value)
  const directUf = value.toUpperCase().match(/\b(AC|AM|AP|BA|DF|GO|MA|MG|MT|PA|PI|RO|RR|TO)\b/)?.[1]

  if (directUf) {
    return directUf
  }

  const stateNames: Record<string, string> = {
    'acre': 'AC',
    'amazonas': 'AM',
    'amapa': 'AP',
    'bahia': 'BA',
    'distrito federal': 'DF',
    'goias': 'GO',
    'maranhao': 'MA',
    'minas gerais': 'MG',
    'mato grosso': 'MT',
    'para': 'PA',
    'piaui': 'PI',
    'rondonia': 'RO',
    'roraima': 'RR',
    'tocantins': 'TO',
  }

  for (const [name, code] of Object.entries(stateNames)) {
    if (normalized.includes(name)) {
      return code
    }
  }

  return null
}

function limitRows(rows: Trf1ImportRow[], maxRows?: number | null) {
  if (!maxRows || maxRows <= 0) {
    return rows
  }

  return rows.slice(0, Math.trunc(maxRows))
}

function normalizeChunkSize(value?: number | null) {
  if (!value || value < 1) {
    return 500
  }

  return Math.max(1, Math.trunc(value))
}

function chunkRows(rows: Trf1ImportRow[], chunkSize: number) {
  const chunks: Trf1ImportRow[][] = []

  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize))
  }

  return chunks
}

function compactText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, ' ')
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
}

function decodeText(buffer: Buffer) {
  const utf8 = buffer.toString('utf8')

  if (!utf8.includes('\uFFFD')) {
    return utf8
  }

  return new TextDecoder('windows-1252').decode(buffer)
}

function normalizeKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function stableHash(value: unknown) {
  return createHash('sha256').update(stableStringify(value)).digest('hex')
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}

export default new Trf1PrecatorioImportService()
