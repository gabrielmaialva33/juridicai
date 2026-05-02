import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import Debtor from '#modules/debtors/models/debtor'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import referenceCatalogService from '#modules/reference/services/reference_catalog_service'
import sourceEvidenceService from '#modules/integrations/services/source_evidence_service'
import tribunalDocumentExtractionService from '#modules/integrations/services/tribunal_document_extraction_service'
import SourceRecord from '#modules/siop/models/source_record'
import { normalizeDebtorName } from '#modules/siop/parsers/debtor_normalizer'
import type { DebtorType, JsonRecord, PaymentRegime } from '#shared/types/model_enums'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type {
  TribunalDocumentExtractionOptions,
  TribunalExtractedRow,
} from '#modules/integrations/services/tribunal_document_extraction_service'

export type GenericTribunalPrecatorioImportOptions = {
  maxRows?: number | null
  pdfTextExtractor?: TribunalDocumentExtractionOptions['pdfTextExtractor']
}

export type GenericTribunalPrecatorioImportStats = {
  totalRows: number
  validRows: number
  selectedRows: number
  inserted: number
  updated: number
  skipped: number
  errors: number
}

type GenericImportRow = {
  extractedRow: TribunalExtractedRow
  cnjNumber: string
  externalId: string
  debtorName: string | null
  debtorType: DebtorType | null
  paymentRegime: PaymentRegime | null
  exerciseYear: number | null
  faceValue: string | null
  rowFingerprint: string
  rawData: JsonRecord
}

type ImportContext = {
  courtId: string | null
  courtAlias: string | null
  stateCode: string | null
  sourceDatasetKey: string | null
}

class GenericTribunalPrecatorioImportService {
  async importSourceRecord(
    sourceRecordId: string,
    options: GenericTribunalPrecatorioImportOptions = {}
  ) {
    const sourceRecord = await SourceRecord.findOrFail(sourceRecordId)
    const extraction = await tribunalDocumentExtractionService.extractSourceRecord(
      sourceRecord.id,
      {
        pdfTextExtractor: options.pdfTextExtractor,
        annotateSourceRecord: true,
      }
    )
    const context = await this.buildContext(sourceRecord)
    const importRows = extraction.rows
      .map((row) => buildImportRow(sourceRecord, row, context))
      .filter((row): row is GenericImportRow => row !== null)
    const selectedRows = limitRows(importRows, options.maxRows)
    const stats: GenericTribunalPrecatorioImportStats = {
      totalRows: extraction.rows.length,
      validRows: importRows.length,
      selectedRows: selectedRows.length,
      inserted: 0,
      updated: 0,
      skipped: extraction.rows.length - importRows.length,
      errors: extraction.errors.length,
    }

    for (const row of selectedRows) {
      try {
        await db.transaction(async (trx) => {
          const result = await this.upsertRow(sourceRecord, row, context, trx)
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

  private async buildContext(sourceRecord: SourceRecord): Promise<ImportContext> {
    const courtAlias = stringField(sourceRecord.rawData?.courtAlias)?.toLowerCase() ?? null
    const stateCode = stringField(sourceRecord.rawData?.stateCode)?.toUpperCase() ?? null
    const court = courtAlias
      ? await referenceCatalogService.court({
          code: courtAlias.toUpperCase(),
          alias: courtAlias,
          name: `Tribunal ${courtAlias.toUpperCase()}`,
        })
      : null

    return {
      courtId: court?.id ?? null,
      courtAlias,
      stateCode,
      sourceDatasetKey: sourceDatasetKeyFor(sourceRecord),
    }
  }

  private async upsertRow(
    sourceRecord: SourceRecord,
    row: GenericImportRow,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
    const debtor = row.debtorName
      ? await this.findOrCreateDebtor(sourceRecord, row, context, trx)
      : null
    const existing = await PrecatorioAsset.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('cnj_number', row.cnjNumber)
      .first()
    const payload = {
      tenantId: sourceRecord.tenantId,
      sourceRecordId: sourceRecord.id,
      source: 'tribunal' as const,
      externalId: row.externalId,
      cnjNumber: row.cnjNumber,
      originProcessNumber: row.cnjNumber,
      debtorId: debtor?.id ?? null,
      courtId: context.courtId,
      assetNumber: row.cnjNumber,
      exerciseYear: row.exerciseYear,
      budgetYear: row.exerciseYear,
      nature: 'unknown' as const,
      lifecycleStatus: 'discovered' as const,
      piiStatus: 'pseudonymous' as const,
      complianceStatus: 'approved_for_analysis' as const,
      rawData: buildAssetRawData(sourceRecord, row, context),
      rowFingerprint: row.rowFingerprint,
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
    row: GenericImportRow,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
    const normalizedKey = normalizeDebtorName(row.debtorName!) ?? normalizeKey(row.debtorName!)
    const stateCode = context.stateCode ?? 'BR'
    const existing = await Debtor.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('normalized_key', normalizedKey)
      .where('state_code', stateCode)
      .first()

    if (existing) {
      return existing
    }

    return Debtor.create(
      {
        tenantId: sourceRecord.tenantId,
        name: row.debtorName!,
        normalizedName: normalizedKey,
        normalizedKey,
        debtorType: row.debtorType ?? 'state',
        cnpj: null,
        stateCode,
        paymentRegime: row.paymentRegime ?? 'special',
      },
      { client: trx }
    )
  }

  private async upsertRelatedRecords(
    sourceRecord: SourceRecord,
    asset: PrecatorioAsset,
    row: GenericImportRow,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
    await this.upsertValuation(sourceRecord, asset.id, row, trx)
    await this.upsertJudicialProcess(sourceRecord, asset, row, context, trx)
    await this.upsertImportEvent(sourceRecord, asset.id, row, context, trx)
    await this.recordEvidence(sourceRecord, asset, row, context, trx)
  }

  private async upsertValuation(
    sourceRecord: SourceRecord,
    assetId: string,
    row: GenericImportRow,
    trx: TransactionClientContract
  ) {
    if (!row.faceValue) {
      return null
    }

    const existing = await AssetValuation.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('asset_id', assetId)
      .where('source_record_id', sourceRecord.id)
      .whereRaw("raw_data->>'rowFingerprint' = ?", [row.rowFingerprint])
      .first()
    const payload = {
      tenantId: sourceRecord.tenantId,
      assetId,
      faceValue: row.faceValue,
      estimatedUpdatedValue: row.faceValue,
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

  private async upsertJudicialProcess(
    sourceRecord: SourceRecord,
    asset: PrecatorioAsset,
    row: GenericImportRow,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
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
      courtAlias: context.courtAlias,
      rawData: buildProcessRawData(sourceRecord, row, context),
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
    row: GenericImportRow,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
    const idempotencyKey = `generic-tribunal:${sourceRecord.id}:${row.rowFingerprint}`
    const existing = await AssetEvent.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('asset_id', assetId)
      .where('event_type', 'generic_tribunal_document_imported')
      .where('idempotency_key', idempotencyKey)
      .first()

    if (existing) {
      return existing
    }

    return AssetEvent.create(
      {
        tenantId: sourceRecord.tenantId,
        assetId,
        eventType: 'generic_tribunal_document_imported',
        eventDate: DateTime.now(),
        source: 'tribunal',
        payload: buildAssetRawData(sourceRecord, row, context),
        idempotencyKey,
      },
      { client: trx }
    )
  }

  private async recordEvidence(
    sourceRecord: SourceRecord,
    asset: PrecatorioAsset,
    row: GenericImportRow,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
    await sourceEvidenceService.linkAsset({
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: context.sourceDatasetKey,
      linkType: 'primary',
      confidence: 0.8,
      matchReason: 'generic_tribunal_document_cnj_match',
      matchedFields: {
        cnjNumber: row.cnjNumber,
        rowFingerprint: row.rowFingerprint,
      },
      normalizedPayload: {
        value: row.faceValue,
        exerciseYear: row.exerciseYear,
        debtorName: row.debtorName,
      },
      rawPointer: {
        sourceRecordId: sourceRecord.id,
        rowNumber: row.extractedRow.rowNumber,
        rowFingerprint: row.rowFingerprint,
      },
      trx,
    })

    await sourceEvidenceService.upsertIdentifier({
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: context.sourceDatasetKey,
      identifierType: 'cnj_number',
      identifierValue: row.cnjNumber,
      issuer: context.courtAlias?.toUpperCase() ?? 'TRIBUNAL',
      isPrimary: true,
      rawData: row.rawData,
      trx,
    })
  }
}

function buildImportRow(
  sourceRecord: SourceRecord,
  row: TribunalExtractedRow,
  context: ImportContext
): GenericImportRow | null {
  if (!row.normalizedCnj) {
    return null
  }

  const debtorName = debtorNameFromRow(row.rawData)
  const debtorProfile = debtorName ? debtorProfileFor(debtorName, context.stateCode) : null
  const rawData = {
    providerId: 'generic-tribunal-document-import',
    sourceRecordId: sourceRecord.id,
    sourceUrl: sourceRecord.sourceUrl,
    courtAlias: context.courtAlias,
    stateCode: context.stateCode,
    rowNumber: row.rowNumber,
    rowFingerprint: row.rowFingerprint,
    extractedRow: row.rawData,
  } satisfies JsonRecord

  return {
    extractedRow: row,
    cnjNumber: row.normalizedCnj,
    externalId: `${context.courtAlias ?? 'tribunal'}:${row.normalizedCnj}`,
    debtorName,
    debtorType: debtorProfile?.debtorType ?? null,
    paymentRegime: debtorProfile?.paymentRegime ?? null,
    exerciseYear: row.normalizedYear,
    faceValue: row.normalizedValue,
    rowFingerprint: row.rowFingerprint,
    rawData,
  }
}

function debtorNameFromRow(row: JsonRecord) {
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeKey(key)
    if (
      !/(DEVEDOR|ENTIDADE|ENTE|FAZENDA|REQUERID)/.test(normalizedKey) ||
      /BENEFICIARIO|CREDOR|AUTOR|ADVOGADO/.test(normalizedKey)
    ) {
      continue
    }

    const text = stringField(value)
    if (text && !text.match(/^\d+$/)) {
      return text
    }
  }

  return null
}

function debtorProfileFor(
  debtorName: string,
  stateCode: string | null
): { debtorType: DebtorType; paymentRegime: PaymentRegime } {
  const normalized = normalizeKey(debtorName)

  if (normalized.includes('UNIAO')) {
    return { debtorType: 'union', paymentRegime: 'federal_unique' }
  }

  if (normalized.includes('INSS')) {
    return { debtorType: 'autarchy', paymentRegime: 'federal_unique' }
  }

  if (
    normalized.includes('MUNICIP') ||
    normalized.includes('PREFEITURA') ||
    normalized.includes('CAMARA')
  ) {
    return { debtorType: 'municipality', paymentRegime: 'special' }
  }

  if (normalized.includes('FUNDACAO')) {
    return { debtorType: 'foundation', paymentRegime: 'special' }
  }

  if (normalized.includes('ESTADO') || stateCode) {
    return { debtorType: 'state', paymentRegime: 'special' }
  }

  return { debtorType: 'autarchy', paymentRegime: 'special' }
}

function buildAssetRawData(
  sourceRecord: SourceRecord,
  row: GenericImportRow,
  context: ImportContext
): JsonRecord {
  return {
    ...row.rawData,
    sourceRecordId: sourceRecord.id,
    sourceUrl: sourceRecord.sourceUrl,
    courtAlias: context.courtAlias,
    stateCode: context.stateCode,
  }
}

function buildValuationRawData(row: GenericImportRow): JsonRecord {
  return {
    providerId: 'generic-tribunal-document-import',
    rowFingerprint: row.rowFingerprint,
    value: row.faceValue,
    exerciseYear: row.exerciseYear,
    extractedRow: row.extractedRow.rawData,
  }
}

function buildProcessRawData(
  sourceRecord: SourceRecord,
  row: GenericImportRow,
  context: ImportContext
): JsonRecord {
  return {
    providerId: 'generic-tribunal-document-import',
    sourceRecordId: sourceRecord.id,
    sourceUrl: sourceRecord.sourceUrl,
    courtAlias: context.courtAlias,
    rowFingerprint: row.rowFingerprint,
  }
}

function sourceDatasetKeyFor(sourceRecord: SourceRecord) {
  const targetKey = stringField(sourceRecord.rawData?.targetKey)
  if (targetKey?.startsWith('court-map:')) {
    return 'court-annual-map-pages'
  }

  return null
}

function stringField(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const text = value.trim()
  return text || null
}

function limitRows<T>(rows: T[], limit?: number | null) {
  if (!limit || limit < 1) {
    return rows
  }

  return rows.slice(0, Math.trunc(limit))
}

function normalizeKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export default new GenericTribunalPrecatorioImportService()
