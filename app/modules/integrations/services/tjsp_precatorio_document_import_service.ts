import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import AssetBudgetFact from '#modules/precatorios/models/asset_budget_fact'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import Debtor from '#modules/debtors/models/debtor'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import Court from '#modules/reference/models/court'
import sourceEvidenceService from '#modules/integrations/services/source_evidence_service'
import tribunalDocumentExtractionService, {
  type TribunalExtractedRow,
} from '#modules/integrations/services/tribunal_document_extraction_service'
import type SourceRecord from '#modules/siop/models/source_record'
import type { AssetNature, DebtorType, JsonRecord, PaymentRegime } from '#shared/types/model_enums'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export type TjspPrecatorioDocumentImportStats = {
  extractedRows: number
  importableRows: number
  inserted: number
  updated: number
  skipped: number
  errors: number
}

type TjspPrecatorioDocumentImportRow = {
  row: TribunalExtractedRow
  externalId: string
  debtorName: string
  debtorType: DebtorType
  paymentRegime: PaymentRegime
  nature: AssetNature
  assetNumber: string | null
  queuePosition: number | null
  rawData: JsonRecord
}

class TjspPrecatorioDocumentImportService {
  async importSourceRecord(sourceRecordId: string) {
    const extraction = await tribunalDocumentExtractionService.extractSourceRecord(sourceRecordId, {
      annotateSourceRecord: true,
    })
    const sourceRecord = extraction.sourceRecord
    const rows = extraction.rows
      .map((row) => buildImportRow(sourceRecord, row))
      .filter((row): row is TjspPrecatorioDocumentImportRow => row !== null)
    const stats: TjspPrecatorioDocumentImportStats = {
      extractedRows: extraction.rows.length,
      importableRows: rows.length,
      inserted: 0,
      updated: 0,
      skipped: extraction.rows.length - rows.length,
      errors: 0,
    }

    for (const row of rows) {
      try {
        await db.transaction(async (trx) => {
          const result = await this.upsertRow(sourceRecord, row, trx)
          stats[result] += 1
        })
      } catch {
        stats.errors += 1
      }
    }

    return { sourceRecord, extraction, stats }
  }

  private async upsertRow(
    sourceRecord: SourceRecord,
    row: TjspPrecatorioDocumentImportRow,
    trx: TransactionClientContract
  ) {
    const debtor = await this.findOrCreateDebtor(sourceRecord.tenantId, row, trx)
    const court = await this.findOrCreateCourt(trx)
    const existing = await PrecatorioAsset.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('source', 'tribunal')
      .where('external_id', row.externalId)
      .first()
    const payload = {
      tenantId: sourceRecord.tenantId,
      sourceRecordId: sourceRecord.id,
      source: 'tribunal' as const,
      externalId: row.externalId,
      cnjNumber: row.row.normalizedCnj,
      originProcessNumber: row.row.normalizedCnj,
      debtorId: debtor.id,
      courtId: court?.id ?? null,
      assetNumber: row.assetNumber,
      exerciseYear: row.row.normalizedYear,
      budgetYear: row.row.normalizedYear,
      nature: row.nature,
      lifecycleStatus: 'discovered' as const,
      piiStatus: 'pseudonymous' as const,
      complianceStatus: 'approved_for_analysis' as const,
      rawData: buildAssetRawData(sourceRecord, row),
      rowFingerprint: row.row.rowFingerprint,
    }

    if (existing) {
      existing.useTransaction(trx)
      existing.merge(payload)
      await existing.save()
      await this.upsertRelatedRecords(sourceRecord, existing, row, trx)
      return 'updated' as const
    }

    const asset = await PrecatorioAsset.create(payload, { client: trx })
    await this.upsertRelatedRecords(sourceRecord, asset, row, trx)
    return 'inserted' as const
  }

  private async upsertRelatedRecords(
    sourceRecord: SourceRecord,
    asset: PrecatorioAsset,
    row: TjspPrecatorioDocumentImportRow,
    trx: TransactionClientContract
  ) {
    await this.upsertValuation(sourceRecord, asset.id, row, trx)
    await this.upsertBudgetFact(sourceRecord, asset.id, row, trx)
    await this.upsertJudicialProcess(sourceRecord, asset, row, trx)
    await this.upsertImportEvent(sourceRecord, asset.id, row, trx)
    await this.recordEvidence(sourceRecord, asset, row, trx)
  }

  private async findOrCreateDebtor(
    tenantId: string,
    row: TjspPrecatorioDocumentImportRow,
    trx: TransactionClientContract
  ) {
    const normalizedKey = normalizeKey(row.debtorName)
    const existing = await Debtor.query({ client: trx })
      .where('tenant_id', tenantId)
      .where('normalized_key', normalizedKey)
      .where('state_code', 'SP')
      .first()

    if (existing) {
      return existing
    }

    return Debtor.create(
      {
        tenantId,
        name: row.debtorName,
        normalizedName: normalizedKey,
        normalizedKey,
        debtorType: row.debtorType,
        cnpj: null,
        stateCode: 'SP',
        paymentRegime: row.paymentRegime,
      },
      { client: trx }
    )
  }

  private async findOrCreateCourt(trx: TransactionClientContract) {
    const existing = await Court.query({ client: trx }).where('code', 'TJSP').first()

    if (existing) {
      existing.merge({
        alias: 'tjsp',
        name: 'Tribunal de Justiça do Estado de São Paulo',
      })
      await existing.save()
      return existing
    }

    return Court.create(
      {
        code: 'TJSP',
        alias: 'tjsp',
        name: 'Tribunal de Justiça do Estado de São Paulo',
        courtClass: null,
      },
      { client: trx }
    )
  }

  private async upsertValuation(
    sourceRecord: SourceRecord,
    assetId: string,
    row: TjspPrecatorioDocumentImportRow,
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
      faceValue: row.row.normalizedValue,
      estimatedUpdatedValue: row.row.normalizedValue,
      queuePosition: row.queuePosition,
      sourceRecordId: sourceRecord.id,
      computedAt: DateTime.now(),
      rawData: buildValuationRawData(row),
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
    row: TjspPrecatorioDocumentImportRow,
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
      exerciseYear: row.row.normalizedYear,
      budgetYear: row.row.normalizedYear,
      sourceRecordId: sourceRecord.id,
      rawData: buildBudgetFactRawData(row),
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
    row: TjspPrecatorioDocumentImportRow,
    trx: TransactionClientContract
  ) {
    if (!row.row.normalizedCnj) {
      return null
    }

    const court = await this.findOrCreateCourt(trx)
    const existing = await JudicialProcess.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('cnj_number', row.row.normalizedCnj)
      .first()
    const payload = {
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      source: 'tribunal' as const,
      cnjNumber: row.row.normalizedCnj,
      courtId: court?.id ?? null,
      courtAlias: 'tjsp',
      rawData: {
        providerId: 'tjsp-precatorio-communications',
        sourceRecordId: sourceRecord.id,
        rowFingerprint: row.row.rowFingerprint,
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

  private async upsertImportEvent(
    sourceRecord: SourceRecord,
    assetId: string,
    row: TjspPrecatorioDocumentImportRow,
    trx: TransactionClientContract
  ) {
    const idempotencyKey = `tjsp-document:${sourceRecord.id}:${row.row.rowFingerprint}`
    const existing = await AssetEvent.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('asset_id', assetId)
      .where('event_type', 'tjsp_document_imported')
      .where('idempotency_key', idempotencyKey)
      .first()

    if (existing) {
      return existing
    }

    return AssetEvent.create(
      {
        tenantId: sourceRecord.tenantId,
        assetId,
        eventType: 'tjsp_document_imported',
        eventDate: DateTime.now(),
        source: 'tribunal',
        payload: buildAssetRawData(sourceRecord, row),
        idempotencyKey,
      },
      { client: trx }
    )
  }

  private async recordEvidence(
    sourceRecord: SourceRecord,
    asset: PrecatorioAsset,
    row: TjspPrecatorioDocumentImportRow,
    trx: TransactionClientContract
  ) {
    await sourceEvidenceService.linkAsset({
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: 'tjsp-precatorio-communications',
      linkType: 'primary',
      confidence: row.row.normalizedCnj ? 0.95 : 0.7,
      matchReason: row.row.normalizedCnj
        ? 'tjsp_document_cnj_match'
        : 'tjsp_document_row_fingerprint',
      matchedFields: {
        cnjNumber: row.row.normalizedCnj,
        rowFingerprint: row.row.rowFingerprint,
        normalizedValue: row.row.normalizedValue,
        normalizedYear: row.row.normalizedYear,
      },
      normalizedPayload: {
        externalId: row.externalId,
        debtorName: row.debtorName,
        assetNumber: row.assetNumber,
        queuePosition: row.queuePosition,
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
      sourceDatasetKey: 'tjsp-precatorio-communications',
      identifierType: 'source_external_id',
      identifierValue: row.externalId,
      issuer: 'TJSP',
      isPrimary: !row.row.normalizedCnj,
      rawData: row.rawData,
      trx,
    })

    await sourceEvidenceService.upsertIdentifier({
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: 'tjsp-precatorio-communications',
      identifierType: 'cnj_number',
      identifierValue: row.row.normalizedCnj,
      issuer: 'TJSP',
      isPrimary: true,
      rawData: row.rawData,
      trx,
    })
  }
}

function buildImportRow(
  sourceRecord: SourceRecord,
  row: TribunalExtractedRow
): TjspPrecatorioDocumentImportRow | null {
  if (!row.normalizedCnj && !row.normalizedValue && !row.normalizedYear) {
    return null
  }

  const debtorName =
    textFromKeys(row.rawData, [
      'entidade',
      'entidade_devedora',
      'devedor',
      'ente_devedor',
      'orgao_devedor',
      'fazenda',
    ]) ?? debtorNameFromSource(sourceRecord)
  const debtorProfile = classifyDebtor(debtorName)
  const externalId = row.normalizedCnj
    ? `tjsp:${row.normalizedCnj}`
    : `tjsp:${sourceRecord.id}:${row.rowFingerprint}`

  return {
    row,
    externalId,
    debtorName,
    debtorType: debtorProfile.debtorType,
    paymentRegime: debtorProfile.paymentRegime,
    nature: detectNature(row.rawData),
    assetNumber:
      row.normalizedCnj ?? textFromKeys(row.rawData, ['precatorio', 'numero_precatorio']),
    queuePosition: numberFromKeys(row.rawData, [
      'ordem',
      'ordem_cronologica',
      'posicao',
      'classificacao',
    ]),
    rawData: buildRowRawData(sourceRecord, row),
  }
}

function buildAssetRawData(
  sourceRecord: SourceRecord,
  row: TjspPrecatorioDocumentImportRow
): JsonRecord {
  return {
    providerId: 'tjsp-precatorio-communications',
    sourceRecordId: sourceRecord.id,
    sourceUrl: sourceRecord.sourceUrl,
    courtAlias: 'tjsp',
    stateCode: 'SP',
    communicationCode: sourceRecord.rawData?.communicationCode ?? null,
    documentExternalCode: sourceRecord.rawData?.externalCode ?? null,
    rowNumber: row.row.rowNumber,
    rowFingerprint: row.row.rowFingerprint,
    row: row.row.rawData,
  }
}

function buildValuationRawData(row: TjspPrecatorioDocumentImportRow): JsonRecord {
  return {
    providerId: 'tjsp-precatorio-communications',
    rowFingerprint: row.row.rowFingerprint,
    normalizedValue: row.row.normalizedValue,
    queuePosition: row.queuePosition,
    row: row.row.rawData,
  }
}

function buildBudgetFactRawData(row: TjspPrecatorioDocumentImportRow): JsonRecord {
  return {
    providerId: 'tjsp-precatorio-communications',
    rowFingerprint: row.row.rowFingerprint,
    normalizedYear: row.row.normalizedYear,
    row: row.row.rawData,
  }
}

function buildRowRawData(sourceRecord: SourceRecord, row: TribunalExtractedRow): JsonRecord {
  return {
    providerId: 'tjsp-precatorio-communications',
    sourceRecordId: sourceRecord.id,
    rowNumber: row.rowNumber,
    rowFingerprint: row.rowFingerprint,
    normalizedCnj: row.normalizedCnj,
    normalizedValue: row.normalizedValue,
    normalizedYear: row.normalizedYear,
    row: row.rawData,
  }
}

function debtorNameFromSource(sourceRecord: SourceRecord) {
  const title = String(sourceRecord.rawData?.title ?? '').trim()
  return title || 'TJSP debtor not identified'
}

function classifyDebtor(name: string): { debtorType: DebtorType; paymentRegime: PaymentRegime } {
  const normalized = normalizeKey(name)

  if (normalized.includes('INSS')) {
    return { debtorType: 'autarchy', paymentRegime: 'federal_unique' }
  }

  if (normalized.includes('MUNICIP') || normalized.includes('PREFEITURA')) {
    return { debtorType: 'municipality', paymentRegime: 'special' }
  }

  if (normalized.includes('FUNDACAO')) {
    return { debtorType: 'foundation', paymentRegime: 'special' }
  }

  if (normalized.includes('INSTITUTO') || normalized.includes('AUTARQUIA')) {
    return { debtorType: 'autarchy', paymentRegime: 'special' }
  }

  return { debtorType: 'state', paymentRegime: 'special' }
}

function detectNature(row: JsonRecord): AssetNature {
  const normalized = normalizeKey(Object.values(row).join(' '))

  if (normalized.includes('ALIMENT')) {
    return 'alimentar'
  }

  if (normalized.includes('TRIBUT')) {
    return 'tributario'
  }

  if (normalized.includes('COMUM')) {
    return 'comum'
  }

  return 'unknown'
}

function textFromKeys(row: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function numberFromKeys(row: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    const parsed = Number(String(value ?? '').replace(/\D/g, ''))

    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return null
}

function normalizeKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function stableHash(value: unknown) {
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

export default new TjspPrecatorioDocumentImportService()
