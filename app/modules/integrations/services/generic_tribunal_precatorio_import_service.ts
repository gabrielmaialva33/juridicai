import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import Debtor from '#modules/debtors/models/debtor'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import referenceCatalogService from '#modules/reference/services/reference_catalog_service'
import sourceEvidenceService from '#modules/integrations/services/source_evidence_service'
import type {
  TribunalDocumentExtractionOptions,
  TribunalExtractedRow,
} from '#modules/integrations/services/tribunal_document_extraction_service'
import tribunalDocumentExtractionService from '#modules/integrations/services/tribunal_document_extraction_service'
import type SourceRecord from '#modules/siop/models/source_record'
import sourceRecordRepository from '#modules/siop/repositories/source_record_repository'
import { normalizeDebtorName } from '#modules/siop/parsers/debtor_normalizer'
import type { AssetNature, DebtorType, JsonRecord, PaymentRegime } from '#shared/types/model_enums'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

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
  nature: AssetNature
  receivedAt: DateTime | null
  queuePosition: number | null
  preferenceLabel: string | null
  faceValue: string | null
  rowFingerprint: string
  rawData: JsonRecord
}

type ImportContext = {
  courtId: string | null
  courtAlias: string | null
  stateCode: string | null
  sourceDatasetKey: string | null
  sourceKind: string | null
}

class GenericTribunalPrecatorioImportService {
  async importSourceRecord(
    sourceRecordId: string,
    options: GenericTribunalPrecatorioImportOptions = {}
  ) {
    const sourceRecord = await sourceRecordRepository.findAnyByIdOrFail(sourceRecordId)
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
      sourceKind: stringField(sourceRecord.rawData?.sourceKind),
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
      nature: row.nature,
      originFiledAt: row.receivedAt,
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
    await this.upsertPreferenceEvent(sourceRecord, asset.id, row, context, trx)
    await this.upsertOperationalSignalEvents(sourceRecord, asset.id, row, context, trx)
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

  private async upsertPreferenceEvent(
    sourceRecord: SourceRecord,
    assetId: string,
    row: GenericImportRow,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
    if (!isSuperpreference(row.preferenceLabel)) {
      return null
    }

    const idempotencyKey = `generic-tribunal:superpreference:${sourceRecord.id}:${row.rowFingerprint}`
    const existing = await AssetEvent.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('asset_id', assetId)
      .where('event_type', 'superpreference_granted')
      .where('idempotency_key', idempotencyKey)
      .first()

    if (existing) {
      return existing
    }

    return AssetEvent.create(
      {
        tenantId: sourceRecord.tenantId,
        assetId,
        eventType: 'superpreference_granted',
        eventDate: row.receivedAt ?? DateTime.now(),
        source: 'tribunal',
        payload: {
          providerId: 'generic-tribunal-document-import',
          sourceRecordId: sourceRecord.id,
          sourceUrl: sourceRecord.sourceUrl,
          courtAlias: context.courtAlias,
          stateCode: context.stateCode,
          preferenceLabel: row.preferenceLabel,
          queuePosition: row.queuePosition,
          rowFingerprint: row.rowFingerprint,
          extractedRow: row.extractedRow.rawData,
        },
        idempotencyKey,
      },
      { client: trx }
    )
  }

  private async upsertOperationalSignalEvents(
    sourceRecord: SourceRecord,
    assetId: string,
    row: GenericImportRow,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
    for (const signal of operationalSignalsFor(row, context)) {
      const idempotencyKey = `generic-tribunal:${signal.eventType}:${sourceRecord.id}:${row.rowFingerprint}`
      const existing = await AssetEvent.query({ client: trx })
        .where('tenant_id', sourceRecord.tenantId)
        .where('asset_id', assetId)
        .where('event_type', signal.eventType)
        .where('idempotency_key', idempotencyKey)
        .first()

      if (existing) {
        continue
      }

      await AssetEvent.create(
        {
          tenantId: sourceRecord.tenantId,
          assetId,
          eventType: signal.eventType,
          eventDate: row.receivedAt ?? DateTime.now(),
          source: 'tribunal',
          payload: {
            providerId: 'generic-tribunal-operational-signal',
            sourceRecordId: sourceRecord.id,
            sourceUrl: sourceRecord.sourceUrl,
            courtAlias: context.courtAlias,
            stateCode: context.stateCode,
            sourceKind: context.sourceKind,
            queuePosition: row.queuePosition,
            preferenceLabel: row.preferenceLabel,
            signalReason: signal.reason,
            rowFingerprint: row.rowFingerprint,
            extractedRow: row.extractedRow.rawData,
          },
          idempotencyKey,
        },
        { client: trx }
      )
    }
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
        nature: row.nature,
        queuePosition: row.queuePosition,
        preferenceLabel: row.preferenceLabel,
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

    await sourceEvidenceService.upsertIdentifier({
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: context.sourceDatasetKey,
      identifierType: 'chronological_order',
      identifierValue: row.queuePosition,
      issuer: context.courtAlias?.toUpperCase() ?? 'TRIBUNAL',
      isPrimary: false,
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

  const debtorName = debtorNameFromRow(row.rawData, context)
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
    nature: natureFromRow(row.rawData),
    receivedAt: dateTimeFromRow(row.rawData),
    queuePosition: queuePositionFromRow(row.rawData),
    preferenceLabel: preferenceFromRow(row.rawData),
    faceValue: row.normalizedValue,
    rowFingerprint: row.rowFingerprint,
    rawData,
  }
}

function debtorNameFromRow(row: JsonRecord, context: ImportContext) {
  const preferred =
    stringField(row.ente_devedor) ??
    stringField(row.entidade_devedora) ??
    stringField(row.devedor) ??
    stringField(row.entidade)

  if (preferred && !preferred.match(/^\d+$/)) {
    return normalizeDebtorDisplayName(preferred, context)
  }

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeKey(key)
    if (
      !/(DEVEDOR|ENTIDADE|ENTE|FAZENDA|REQUERID)/.test(normalizedKey) ||
      /BENEFICIARIO|CREDOR|AUTOR|ADVOGADO|GRUPO_DEVEDOR|FONTE|SOURCE|TARGET/.test(normalizedKey)
    ) {
      continue
    }

    const text = stringField(value)
    if (text && !text.match(/^\d+$/)) {
      return normalizeDebtorDisplayName(text, context)
    }
  }

  return null
}

function normalizeDebtorDisplayName(value: string, context: ImportContext) {
  const normalized = normalizeKey(value)

  if (context.courtAlias === 'tjma' && context.stateCode === 'MA') {
    if (normalized === 'ESTADO') {
      return 'Estado do Maranhão'
    }

    if (normalized === 'IPREV') {
      return 'IPREV Maranhão'
    }
  }

  return value
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

  if (normalized.includes('IPREV')) {
    return { debtorType: 'autarchy', paymentRegime: 'special' }
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

function natureFromRow(row: JsonRecord): AssetNature {
  const rawNature = stringField(row.natureza) ?? stringField(row.nature) ?? ''
  const normalized = normalizeKey(rawNature)

  if (normalized.includes('ALIMENTAR')) {
    return 'alimentar'
  }

  if (normalized.includes('TRIBUT')) {
    return 'tributario'
  }

  if (normalized.includes('COMUM') || normalized.includes('NAO_ALIMENTAR')) {
    return 'comum'
  }

  return 'unknown'
}

function queuePositionFromRow(row: JsonRecord) {
  return numberField(row.ordem) ?? numberField(row.queue_position) ?? numberField(row.queuePosition)
}

function preferenceFromRow(row: JsonRecord) {
  return stringField(row.prioridade) ?? stringField(row.priority) ?? stringField(row.preference)
}

function operationalSignalsFor(row: GenericImportRow, context: ImportContext) {
  const signals: Array<{ eventType: string; reason: string }> = []

  if (row.queuePosition !== null && row.queuePosition <= 100) {
    signals.push({
      eventType: 'queue_position_favorable',
      reason: `Queue position ${row.queuePosition} is within the first 100 entries.`,
    })
  }

  if (row.queuePosition === null && context.sourceKind === 'chronological_list') {
    signals.push({
      eventType: 'queue_position_unknown',
      reason: 'Chronological list row did not expose a reliable queue position.',
    })
  }

  if (context.sourceKind === 'direct_agreement') {
    signals.push({
      eventType: 'direct_agreement_window',
      reason: 'Source document is a direct agreement report.',
    })
  }

  if (context.sourceKind === 'preferential_lot') {
    signals.push({
      eventType: 'preferential_queue',
      reason: 'Source document is a preferential payment lot.',
    })
  }

  if (context.sourceKind === 'paid_or_payment_process') {
    signals.push({
      eventType: 'payment_process_detected',
      reason: 'Source document reports paid precatorios or payment processing.',
    })
  }

  return signals
}

function dateTimeFromRow(row: JsonRecord) {
  const value = stringField(row.recebido_em) ?? stringField(row.received_at)
  if (!value) {
    return null
  }

  const parsed = DateTime.fromISO(value)
  return parsed.isValid ? parsed : null
}

function isSuperpreference(value: string | null) {
  if (!value) {
    return false
  }

  const normalized = normalizeKey(value)
  return (
    normalized.includes('IDADE') ||
    normalized.includes('IDOS') ||
    normalized.includes('DOENCA_GRAVE') ||
    normalized.includes('PREFERENCIAL') ||
    normalized.includes('SUPERPREFER')
  )
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
    nature: row.nature,
    queuePosition: row.queuePosition,
    preferenceLabel: row.preferenceLabel,
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

function numberField(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }

  if (typeof value !== 'string') {
    return null
  }

  const number = Number(value.trim())
  return Number.isInteger(number) ? number : null
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
