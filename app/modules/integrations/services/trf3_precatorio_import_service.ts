import { createHash } from 'node:crypto'
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

export type Trf3PrecatorioImportOptions = {
  maxRows?: number | null
  chunkSize?: number | null
}

export type Trf3PrecatorioImportStats = {
  totalRows: number
  validRows: number
  selectedRows: number
  inserted: number
  updated: number
  skipped: number
  errors: number
}

type Trf3ImportRow = {
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
  rawData: JsonRecord
}

type ImportContext = {
  courtId: string | null
  judicialClassId: string | null
}

class Trf3PrecatorioImportService {
  async importSourceRecord(sourceRecordId: string, options: Trf3PrecatorioImportOptions = {}) {
    const sourceRecord = await SourceRecord.findOrFail(sourceRecordId)
    const extraction = await tribunalDocumentExtractionService.extractSourceRecord(
      sourceRecord.id,
      {
        annotateSourceRecord: true,
      }
    )
    const rows = extraction.rows.map((row) => normalizeRow(sourceRecord, row))
    const validRows = rows.filter((row): row is Trf3ImportRow => Boolean(row))
    const selectedRows = limitRows(validRows, options.maxRows)
    const chunkSize = normalizeChunkSize(options.chunkSize)
    const batches = chunkRows(selectedRows, chunkSize)
    const context = await this.buildContext()
    const stats: Trf3PrecatorioImportStats = {
      totalRows: extraction.rows.length,
      validRows: validRows.length,
      selectedRows: selectedRows.length,
      inserted: 0,
      updated: 0,
      skipped: extraction.rows.length - validRows.length,
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
      code: 'TRF3',
      alias: 'trf3',
      name: 'Tribunal Regional Federal da 3ª Região',
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
    row: Trf3ImportRow,
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
      lifecycleStatus: 'discovered' as const,
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
    row: Trf3ImportRow,
    trx: TransactionClientContract
  ) {
    const profile = debtorProfileFor(row.debtorName)
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
    row: Trf3ImportRow,
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
    row: Trf3ImportRow,
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
    row: Trf3ImportRow,
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
      expenseType: stringField(row.rawData.tipo_despesa ?? row.rawData.tipo),
      causeType: stringField(row.rawData.assunto ?? row.rawData.causa),
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
    row: Trf3ImportRow,
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
      courtAlias: 'trf3',
      filedAt: row.filedAt,
      rawData: {
        providerId: 'trf3-cnj-102-precatorios-rpv',
        courtAlias: 'trf3',
        sourceRecordId: sourceRecord.id,
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
    row: Trf3ImportRow,
    trx: TransactionClientContract
  ) {
    const idempotencyKey = `trf3:${sourceRecord.id}:${row.row.rowFingerprint}`
    const existing = await AssetEvent.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('asset_id', assetId)
      .where('event_type', 'trf3_imported')
      .where('idempotency_key', idempotencyKey)
      .first()

    if (existing) {
      return existing
    }

    return AssetEvent.create(
      {
        tenantId: sourceRecord.tenantId,
        assetId,
        eventType: 'trf3_imported',
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
    row: Trf3ImportRow,
    trx: TransactionClientContract
  ) {
    await sourceEvidenceService.linkAsset({
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: 'trf3-cnj-102-precatorios-rpv',
      linkType: 'primary',
      confidence: row.cnjNumber ? 1 : 0.75,
      matchReason: row.cnjNumber ? 'trf3_cnj_report_match' : 'trf3_source_row_match',
      matchedFields: {
        cnjNumber: row.cnjNumber,
        processNumber: row.processNumber,
        rowFingerprint: row.row.rowFingerprint,
      },
      normalizedPayload: {
        cnjNumber: row.cnjNumber,
        processNumber: row.processNumber,
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

    await sourceEvidenceService.upsertIdentifier({
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: 'trf3-cnj-102-precatorios-rpv',
      identifierType: 'precatorio_number',
      identifierValue: row.processNumber,
      issuer: 'TRF3',
      isPrimary: true,
      rawData: buildAssetRawData(sourceRecord, row),
      trx,
    })

    if (row.cnjNumber) {
      await sourceEvidenceService.upsertIdentifier({
        tenantId: sourceRecord.tenantId,
        assetId: asset.id,
        sourceRecordId: sourceRecord.id,
        sourceDatasetKey: 'trf3-cnj-102-precatorios-rpv',
        identifierType: 'cnj_number',
        identifierValue: row.cnjNumber,
        issuer: 'TRF3',
        isPrimary: true,
        rawData: buildAssetRawData(sourceRecord, row),
        trx,
      })
    }

    await sourceEvidenceService.upsertIdentifier({
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: 'trf3-cnj-102-precatorios-rpv',
      identifierType: 'requisition_number',
      identifierValue: row.requisitionNumber,
      issuer: 'TRF3',
      rawData: buildAssetRawData(sourceRecord, row),
      trx,
    })
  }
}

function normalizeRow(sourceRecord: SourceRecord, row: TribunalExtractedRow): Trf3ImportRow | null {
  const processNumber = firstString(row.rawData, [
    'processo',
    'numero_do_processo',
    'numero_processo',
    'numero_do_precatorio',
    'precatorio',
    'prc',
    'num_req',
    'numero_da_requisicao',
    'requisicao',
  ])
  const requisitionNumber = firstString(row.rawData, [
    'num_req',
    'numero_requisicao',
    'numero_da_requisicao',
    'requisicao',
  ])
  const cnjNumber = row.normalizedCnj ?? normalizeCnj(processNumber)
  const value = firstMoney(row.rawData, [
    'valor_atualizado',
    'valor_requisitado',
    'valor_do_precatorio',
    'valor',
    'valor_principal',
    'parcela_devida',
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
      'numero_ordem',
      'n_de_ordem_cronologica',
    ]),
    proposalYear:
      firstNumber(row.rawData, ['proposta', 'exercicio', 'ano_proposta', 'ano_orcamento', 'ano']) ??
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
      ])
    ),
    rawData: row.rawData,
  }
}

function buildExternalId(sourceRecord: SourceRecord, row: Trf3ImportRow) {
  return [
    'trf3',
    sourceRecord.rawData?.sourceKind ?? 'cnj_102_monthly_report',
    sourceRecord.rawData?.year ?? row.proposalYear ?? 'unknown',
    sourceRecord.rawData?.month ?? 'unknown',
    row.cnjNumber ?? row.processNumber,
    row.row.rowFingerprint.slice(0, 16),
  ].join(':')
}

function buildAssetRawData(sourceRecord: SourceRecord, row: Trf3ImportRow): JsonRecord {
  return {
    providerId: 'trf3-cnj-102-precatorios-rpv',
    sourceRecordId: sourceRecord.id,
    sourceUrl: sourceRecord.sourceUrl,
    courtAlias: 'trf3',
    sourceKind: sourceRecord.rawData?.sourceKind ?? null,
    year: sourceRecord.rawData?.year ?? null,
    month: sourceRecord.rawData?.month ?? null,
    format: sourceRecord.rawData?.format ?? null,
    processNumber: row.processNumber,
    cnjNumber: row.cnjNumber,
    originProcessNumber: row.originProcessNumber,
    requisitionNumber: row.requisitionNumber,
    debtorName: row.debtorName,
    proposalYear: row.proposalYear,
    value: row.value,
    filedAt: row.filedAt?.toISODate() ?? null,
    nature: row.nature,
    rowNumber: row.row.rowNumber,
    rowFingerprint: row.row.rowFingerprint,
    rowRawData: row.rawData,
  }
}

function buildEventRawData(sourceRecord: SourceRecord, row: Trf3ImportRow): JsonRecord {
  return {
    providerId: 'trf3-cnj-102-precatorios-rpv',
    sourceRecordId: sourceRecord.id,
    processNumber: row.processNumber,
    cnjNumber: row.cnjNumber,
    value: row.value,
    debtorName: row.debtorName,
    proposalYear: row.proposalYear,
    nature: row.nature,
  }
}

function debtorProfileFor(value: string | null): {
  name: string
  normalizedKey: string
  debtorType: DebtorType
  stateCode: string
  paymentRegime: PaymentRegime
} {
  const name = value?.trim() || 'União Federal, autarquias e fundações - TRF3'
  const normalizedKey = normalizeDebtorName(name) ?? 'UNIAO_FEDERAL_AUTARQUIAS_E_FUNDACOES_TRF3'
  const normalized = normalizedKey

  if (normalized.includes('MUNICIPIO') || normalized.includes('PREFEITURA')) {
    return {
      name,
      normalizedKey,
      debtorType: 'municipality',
      stateCode: 'SP',
      paymentRegime: 'other',
    }
  }

  if (normalized.includes('ESTADO DE ') || normalized.includes('FAZENDA DO ESTADO')) {
    return {
      name,
      normalizedKey,
      debtorType: 'state',
      stateCode: normalized.includes('MATO GROSSO DO SUL') ? 'MS' : 'SP',
      paymentRegime: 'other',
    }
  }

  return {
    name,
    normalizedKey,
    debtorType: 'union',
    stateCode: 'BR',
    paymentRegime: 'federal_unique',
  }
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

function limitRows(rows: Trf3ImportRow[], maxRows?: number | null) {
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

function chunkRows(rows: Trf3ImportRow[], chunkSize: number) {
  const chunks: Trf3ImportRow[][] = []

  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize))
  }

  return chunks
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

export default new Trf3PrecatorioImportService()
