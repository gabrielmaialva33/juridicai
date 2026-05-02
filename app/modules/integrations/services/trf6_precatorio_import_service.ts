import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import tribunalDocumentExtractionService from '#modules/integrations/services/tribunal_document_extraction_service'
import sourceEvidenceService from '#modules/integrations/services/source_evidence_service'
import referenceCatalogService from '#modules/reference/services/reference_catalog_service'
import Debtor from '#modules/debtors/models/debtor'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import SourceRecord from '#modules/siop/models/source_record'
import { normalizeCnj } from '#modules/siop/parsers/cnj_parser'
import { parseBrazilianMoney } from '#modules/siop/parsers/value_parser'
import type { AssetNature, JsonRecord } from '#shared/types/model_enums'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export type Trf6PrecatorioImportOptions = {
  maxRows?: number | null
  chunkSize?: number | null
  pdfTextExtractor?: (filePath: string) => Promise<string>
}

export type Trf6PrecatorioImportStats = {
  totalRows: number
  validRows: number
  selectedRows: number
  inserted: number
  updated: number
  skipped: number
  errors: number
}

type Trf6ParsedRow = {
  order: number
  processNumber: string
  cnjNumber: string | null
  value: string | null
  preference: string | null
  nature: AssetNature
  rawText: string
}

type ImportContext = {
  courtId: string | null
  judicialClassId: string | null
}

class Trf6PrecatorioImportService {
  async importSourceRecord(sourceRecordId: string, options: Trf6PrecatorioImportOptions = {}) {
    const sourceRecord = await SourceRecord.findOrFail(sourceRecordId)
    const extraction = await tribunalDocumentExtractionService.extractSourceRecord(
      sourceRecord.id,
      {
        pdfTextExtractor: options.pdfTextExtractor,
        annotateSourceRecord: true,
      }
    )
    const rows = parseTrf6FederalBudgetText(extraction.text ?? '')
    const validRows = rows.filter((row) => row.cnjNumber || row.value)
    const selectedRows = limitRows(validRows, options.maxRows)
    const chunkSize = normalizeChunkSize(options.chunkSize)
    const batches = chunkRows(selectedRows, chunkSize)
    const context = await this.buildContext()
    const stats: Trf6PrecatorioImportStats = {
      totalRows: rows.length,
      validRows: validRows.length,
      selectedRows: selectedRows.length,
      inserted: 0,
      updated: 0,
      skipped: rows.length - validRows.length,
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
      code: 'TRF6',
      alias: 'trf6',
      name: 'Tribunal Regional Federal da 6ª Região',
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
    row: Trf6ParsedRow,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
    const debtor = await this.findOrCreateDebtor(sourceRecord, trx)
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
      originProcessNumber: row.cnjNumber,
      debtorId: debtor.id,
      courtId: context.courtId,
      assetNumber: row.processNumber,
      exerciseYear: numberFrom(sourceRecord.rawData?.year),
      budgetYear: numberFrom(sourceRecord.rawData?.year),
      nature: row.nature,
      lifecycleStatus: 'discovered' as const,
      piiStatus: 'none' as const,
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

  private async findOrCreateDebtor(sourceRecord: SourceRecord, trx: TransactionClientContract) {
    const name = 'União Federal, autarquias e fundações - TRF6'
    const normalizedKey = 'UNIAO_FEDERAL_AUTARQUIAS_E_FUNDACOES_TRF6'
    const existing = await Debtor.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('normalized_key', normalizedKey)
      .where('state_code', 'BR')
      .first()

    if (existing) {
      return existing
    }

    return Debtor.create(
      {
        tenantId: sourceRecord.tenantId,
        name,
        normalizedName: normalizedKey,
        normalizedKey,
        debtorType: 'union',
        cnpj: null,
        stateCode: 'BR',
        paymentRegime: 'federal_unique',
      },
      { client: trx }
    )
  }

  private async upsertRelatedRecords(
    sourceRecord: SourceRecord,
    asset: PrecatorioAsset,
    row: Trf6ParsedRow,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
    await this.createValuation(sourceRecord, asset.id, row, trx)
    await this.upsertJudicialProcess(sourceRecord, asset, row, context, trx)
    await this.createEvent(sourceRecord, asset.id, row, trx)
    await this.recordSourceEvidence(sourceRecord, asset, row, trx)
  }

  private createValuation(
    sourceRecord: SourceRecord,
    assetId: string,
    row: Trf6ParsedRow,
    trx: TransactionClientContract
  ) {
    return AssetValuation.create(
      {
        tenantId: sourceRecord.tenantId,
        assetId,
        faceValue: row.value,
        estimatedUpdatedValue: row.value,
        queuePosition: row.order,
        sourceRecordId: sourceRecord.id,
        rawData: buildAssetRawData(sourceRecord, row),
      },
      { client: trx }
    )
  }

  private async upsertJudicialProcess(
    sourceRecord: SourceRecord,
    asset: PrecatorioAsset,
    row: Trf6ParsedRow,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
    if (!row.cnjNumber) {
      return null
    }

    const payload = {
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      source: 'tribunal' as const,
      cnjNumber: row.cnjNumber,
      courtId: context.courtId,
      classId: context.judicialClassId,
      courtAlias: 'trf6',
      rawData: {
        providerId: 'trf6-federal-precatorio-orders',
        courtAlias: 'trf6',
        sourceRecordId: sourceRecord.id,
        order: row.order,
      },
    }
    const existing = await JudicialProcess.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('cnj_number', row.cnjNumber)
      .first()

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
    row: Trf6ParsedRow,
    trx: TransactionClientContract
  ) {
    const idempotencyKey = `trf6:${sourceRecord.id}:${row.processNumber}:${row.order}`
    const existing = await AssetEvent.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('asset_id', assetId)
      .where('event_type', 'trf6_imported')
      .where('idempotency_key', idempotencyKey)
      .first()

    if (existing) {
      return existing
    }

    return AssetEvent.create(
      {
        tenantId: sourceRecord.tenantId,
        assetId,
        eventType: 'trf6_imported',
        eventDate: DateTime.now(),
        source: 'tribunal',
        payload: buildEventRawData(row),
        idempotencyKey,
      },
      { client: trx }
    )
  }

  private async recordSourceEvidence(
    sourceRecord: SourceRecord,
    asset: PrecatorioAsset,
    row: Trf6ParsedRow,
    trx: TransactionClientContract
  ) {
    await sourceEvidenceService.linkAsset({
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: 'trf6-federal-precatorio-orders',
      linkType: 'primary',
      confidence: row.cnjNumber ? 1 : 0.8,
      matchReason: row.cnjNumber ? 'trf6_cnj_match' : 'trf6_order_match',
      matchedFields: {
        cnjNumber: row.cnjNumber,
        processNumber: row.processNumber,
        order: row.order,
      },
      normalizedPayload: {
        cnjNumber: row.cnjNumber,
        processNumber: row.processNumber,
        value: row.value,
        preference: row.preference,
        nature: row.nature,
      },
      rawPointer: {
        sourceRecordId: sourceRecord.id,
        order: row.order,
      },
      trx,
    })

    await sourceEvidenceService.upsertIdentifier({
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: 'trf6-federal-precatorio-orders',
      identifierType: 'precatorio_number',
      identifierValue: row.processNumber,
      issuer: 'TRF6',
      isPrimary: true,
      rawData: buildAssetRawData(sourceRecord, row),
      trx,
    })

    if (row.cnjNumber) {
      await sourceEvidenceService.upsertIdentifier({
        tenantId: sourceRecord.tenantId,
        assetId: asset.id,
        sourceRecordId: sourceRecord.id,
        sourceDatasetKey: 'trf6-federal-precatorio-orders',
        identifierType: 'cnj_number',
        identifierValue: row.cnjNumber,
        issuer: 'TRF6',
        isPrimary: true,
        rawData: buildAssetRawData(sourceRecord, row),
        trx,
      })
    }
  }
}

export function parseTrf6FederalBudgetText(text: string): Trf6ParsedRow[] {
  const rows: Trf6ParsedRow[] = []
  let nature: AssetNature = 'alimentar'

  for (const line of text.split(/\r?\n/)) {
    const normalized = normalizeText(line)
    if (normalized.includes('PRECATORIOS COMUNS') || normalized.includes('NAO ALIMENTARES')) {
      nature = 'comum'
      continue
    }

    if (normalized.includes('PRECATORIOS ALIMENTARES')) {
      nature = 'alimentar'
      continue
    }

    const row = parseLine(line, nature)
    if (row) {
      rows.push(row)
    }
  }

  return rows
}

function parseLine(line: string, nature: AssetNature): Trf6ParsedRow | null {
  const match = line.match(/^\s*(\d{1,6})\s+(\d{18,20})\s+(\d{1,3}(?:\.\d{3})*,\d{2})(.*)$/)
  if (!match) {
    return null
  }

  const rawPreference = match[4].trim()

  return {
    order: Number(match[1]),
    processNumber: match[2],
    cnjNumber: normalizeTrf6ProcessNumber(match[2]),
    value: parseBrazilianMoney(match[3]),
    preference: rawPreference || null,
    nature,
    rawText: line.replace(/\s+/g, ' ').trim(),
  }
}

function normalizeTrf6ProcessNumber(value: string) {
  const padded = value.padStart(20, '0')
  return normalizeCnj(padded)
}

function buildExternalId(sourceRecord: SourceRecord, row: Trf6ParsedRow) {
  return `trf6:${sourceRecord.rawData?.sourceKind ?? 'federal_budget_order'}:${row.processNumber}:${sourceRecord.rawData?.year ?? 'unknown'}:${row.order}`
}

function buildAssetRawData(sourceRecord: SourceRecord, row: Trf6ParsedRow): JsonRecord {
  return {
    providerId: 'trf6-federal-precatorio-orders',
    sourceRecordId: sourceRecord.id,
    sourceUrl: sourceRecord.sourceUrl,
    courtAlias: 'trf6',
    sourceKind: sourceRecord.rawData?.sourceKind ?? null,
    year: sourceRecord.rawData?.year ?? null,
    processNumber: row.processNumber,
    preference: row.preference,
    nature: row.nature,
    rawText: row.rawText,
  }
}

function buildEventRawData(row: Trf6ParsedRow): JsonRecord {
  return {
    providerId: 'trf6-federal-precatorio-orders',
    processNumber: row.processNumber,
    cnjNumber: row.cnjNumber,
    value: row.value,
    preference: row.preference,
    nature: row.nature,
  }
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
}

function limitRows(rows: Trf6ParsedRow[], maxRows?: number | null) {
  if (!maxRows || maxRows < 1) {
    return rows
  }

  return rows.slice(0, Math.trunc(maxRows))
}

function normalizeChunkSize(chunkSize?: number | null) {
  if (!chunkSize || chunkSize < 1) {
    return 250
  }

  return Math.trunc(chunkSize)
}

function chunkRows(rows: Trf6ParsedRow[], chunkSize: number) {
  const chunks: Trf6ParsedRow[][] = []

  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize))
  }

  return chunks
}

function numberFrom(value: unknown) {
  const number = Number(value)
  return Number.isInteger(number) ? number : null
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

export default new Trf6PrecatorioImportService()
