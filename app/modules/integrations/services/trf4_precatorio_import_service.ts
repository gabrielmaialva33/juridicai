import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import Debtor from '#modules/debtors/models/debtor'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import referenceCatalogService from '#modules/reference/services/reference_catalog_service'
import SourceRecord from '#modules/siop/models/source_record'
import sourceEvidenceService from '#modules/integrations/services/source_evidence_service'
import {
  parseTrf2ChronologicalCsv,
  type Trf2PrecatorioRow,
} from '#modules/integrations/services/trf2_precatorio_adapter'
import type { AssetNature, DebtorType, JsonRecord, PaymentRegime } from '#shared/types/model_enums'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export type Trf4PrecatorioImportOptions = {
  maxGroups?: number | null
  chunkSize?: number | null
}

export type Trf4PrecatorioImportStats = {
  totalRows: number
  validRows: number
  groupedPrecatorios: number
  inserted: number
  updated: number
  skipped: number
  errors: number
}

export type Trf4PrecatorioImportChunking = {
  availableGroups: number
  selectedGroups: number
  chunkSize: number
  processedBatches: number
}

type GroupedPrecatorio = {
  cnjNumber: string
  precatorioNumber: string | null
  proposalYear: number | null
  legalBasis: string | null
  chronologicalOrder: number | null
  autuadoAt: string | null
  paidAt: string | null
  updatedUntil: string | null
  parcelValue: string | null
  originalPaidValue: string | null
  paidValue: string | null
  rows: Trf2PrecatorioRow[]
}

type ImportContext = {
  courtId: string | null
  judicialClassId: string | null
}

class Trf4PrecatorioImportService {
  async importSourceRecord(sourceRecordId: string, options: Trf4PrecatorioImportOptions = {}) {
    const sourceRecord = await SourceRecord.findOrFail(sourceRecordId)
    if (!sourceRecord.sourceFilePath) {
      throw new Error('TRF4 source record file is missing.')
    }

    const rows = parseTrf2ChronologicalCsv(await readFile(sourceRecord.sourceFilePath))
    const validRows = rows.filter((row) => row.cnjNumber)
    const availableGroups = groupRows(validRows)
    const groups = limitGroups(availableGroups, options.maxGroups)
    const chunkSize = normalizeChunkSize(options.chunkSize)
    const batches = chunkGroups(groups, chunkSize)
    const context = await this.buildContext()
    const stats: Trf4PrecatorioImportStats = {
      totalRows: rows.length,
      validRows: validRows.length,
      groupedPrecatorios: groups.length,
      inserted: 0,
      updated: 0,
      skipped: rows.length - validRows.length,
      errors: 0,
    }

    for (const batch of batches) {
      for (const group of batch) {
        try {
          await db.transaction(async (trx) => {
            const result = await this.upsertGroup(sourceRecord, group, context, trx)
            stats[result] += 1
          })
        } catch {
          stats.errors += 1
        }
      }
    }

    return {
      sourceRecord,
      stats,
      chunking: {
        availableGroups: availableGroups.length,
        selectedGroups: groups.length,
        chunkSize,
        processedBatches: batches.length,
      } satisfies Trf4PrecatorioImportChunking,
    }
  }

  private async buildContext(): Promise<ImportContext> {
    const court = await referenceCatalogService.court({
      code: 'TRF4',
      alias: 'trf4',
      name: 'Tribunal Regional Federal da 4ª Região',
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

  private async upsertGroup(
    sourceRecord: SourceRecord,
    group: GroupedPrecatorio,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
    const debtor = await this.findOrCreateDebtor(sourceRecord, trx)
    const existing = await PrecatorioAsset.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('cnj_number', group.cnjNumber)
      .first()
    const rawData = buildAssetRawData(sourceRecord, group)
    const payload = {
      tenantId: sourceRecord.tenantId,
      sourceRecordId: sourceRecord.id,
      source: 'tribunal' as const,
      externalId: `trf4:${group.cnjNumber}`,
      cnjNumber: group.cnjNumber,
      originProcessNumber: group.cnjNumber,
      debtorId: debtor.id,
      courtId: context.courtId,
      assetNumber: group.cnjNumber,
      exerciseYear: group.proposalYear,
      budgetYear: group.proposalYear,
      nature: detectNature(group.legalBasis),
      lifecycleStatus: group.paidValue ? ('paid' as const) : ('discovered' as const),
      piiStatus: 'pseudonymous' as const,
      complianceStatus: 'approved_for_analysis' as const,
      rawData,
      rowFingerprint: stableHash(rawData),
    }

    if (existing) {
      existing.useTransaction(trx)
      existing.merge(payload)
      await existing.save()
      await this.upsertRelatedRecords(sourceRecord, existing, group, context, trx)
      return 'updated' as const
    }

    const asset = await PrecatorioAsset.create(payload, { client: trx })
    await this.upsertRelatedRecords(sourceRecord, asset, group, context, trx)
    return 'inserted' as const
  }

  private async upsertRelatedRecords(
    sourceRecord: SourceRecord,
    asset: PrecatorioAsset,
    group: GroupedPrecatorio,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
    await this.createValuation(sourceRecord, asset.id, group, trx)
    await this.upsertJudicialProcess(sourceRecord, asset, group, context, trx)
    await this.createEvent(sourceRecord, asset.id, group, trx)
    await this.recordSourceEvidence(sourceRecord, asset, group, trx)
  }

  private async findOrCreateDebtor(sourceRecord: SourceRecord, trx: TransactionClientContract) {
    const profile = debtorProfileFor(sourceRecord)
    const existing = await Debtor.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('normalized_key', profile.normalizedKey)
      .where('state_code', 'BR')
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
        stateCode: 'BR',
        paymentRegime: profile.paymentRegime,
      },
      { client: trx }
    )
  }

  private createValuation(
    sourceRecord: SourceRecord,
    assetId: string,
    group: GroupedPrecatorio,
    trx: TransactionClientContract
  ) {
    return AssetValuation.create(
      {
        tenantId: sourceRecord.tenantId,
        assetId,
        faceValue: group.parcelValue,
        estimatedUpdatedValue: group.paidValue ?? group.originalPaidValue ?? group.parcelValue,
        baseDate: parseBrazilianDate(group.autuadoAt),
        queuePosition: group.chronologicalOrder,
        sourceRecordId: sourceRecord.id,
        rawData: buildAssetRawData(sourceRecord, group),
      },
      { client: trx }
    )
  }

  private async upsertJudicialProcess(
    sourceRecord: SourceRecord,
    asset: PrecatorioAsset,
    group: GroupedPrecatorio,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
    const payload = {
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      source: 'tribunal' as const,
      cnjNumber: group.cnjNumber,
      courtId: context.courtId,
      classId: context.judicialClassId,
      courtAlias: 'trf4',
      filedAt: parseBrazilianDate(group.autuadoAt),
      rawData: {
        providerId: 'trf4-chronological-precatorios',
        courtAlias: 'trf4',
        sourceRecordId: sourceRecord.id,
        proposalYear: group.proposalYear,
      },
    }
    const existing = await JudicialProcess.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('cnj_number', group.cnjNumber)
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
    group: GroupedPrecatorio,
    trx: TransactionClientContract
  ) {
    const idempotencyKey = `trf4:${sourceRecord.id}:${group.cnjNumber}`
    const existing = await AssetEvent.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('asset_id', assetId)
      .where('event_type', 'trf4_imported')
      .where('idempotency_key', idempotencyKey)
      .first()

    if (existing) {
      return existing
    }

    return AssetEvent.create(
      {
        tenantId: sourceRecord.tenantId,
        assetId,
        eventType: 'trf4_imported',
        eventDate: DateTime.now(),
        source: 'tribunal',
        payload: buildEventRawData(group),
        idempotencyKey,
      },
      { client: trx }
    )
  }

  private async recordSourceEvidence(
    sourceRecord: SourceRecord,
    asset: PrecatorioAsset,
    group: GroupedPrecatorio,
    trx: TransactionClientContract
  ) {
    await sourceEvidenceService.linkAsset({
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: 'trf4-chronological-precatorios',
      linkType: 'primary',
      confidence: 1,
      matchReason: 'trf4_cnj_match',
      matchedFields: {
        cnjNumber: group.cnjNumber,
        proposalYear: group.proposalYear,
        chronologicalOrder: group.chronologicalOrder,
      },
      normalizedPayload: {
        cnjNumber: group.cnjNumber,
        precatorioNumber: group.precatorioNumber,
        proposalYear: group.proposalYear,
        chronologicalOrder: group.chronologicalOrder,
        paidAt: group.paidAt,
      },
      rawPointer: {
        sourceRecordId: sourceRecord.id,
        rowCount: group.rows.length,
      },
      trx,
    })

    await sourceEvidenceService.upsertIdentifier({
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: 'trf4-chronological-precatorios',
      identifierType: 'cnj_number',
      identifierValue: group.cnjNumber,
      issuer: 'TRF4',
      isPrimary: true,
      rawData: buildAssetRawData(sourceRecord, group),
      trx,
    })
    await sourceEvidenceService.upsertIdentifier({
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: 'trf4-chronological-precatorios',
      identifierType: 'chronological_order',
      identifierValue: group.chronologicalOrder,
      issuer: 'TRF4',
      rawData: buildAssetRawData(sourceRecord, group),
      trx,
    })
  }
}

function groupRows(rows: Trf2PrecatorioRow[]) {
  const groups = new Map<string, GroupedPrecatorio>()

  for (const row of rows) {
    if (!row.cnjNumber) {
      continue
    }

    const existing = groups.get(row.cnjNumber)
    if (!existing) {
      groups.set(row.cnjNumber, {
        cnjNumber: row.cnjNumber,
        precatorioNumber: row.precatorioNumber,
        proposalYear: row.proposalYear,
        legalBasis: row.legalBasis,
        chronologicalOrder: row.chronologicalOrder,
        autuadoAt: row.autuadoAt,
        paidAt: row.paidAt,
        updatedUntil: row.updatedUntil,
        parcelValue: row.parcelValue,
        originalPaidValue: row.originalPaidValue,
        paidValue: row.paidValue,
        rows: [row],
      })
      continue
    }

    existing.rows.push(row)
    existing.parcelValue = sumMoney(existing.parcelValue, row.parcelValue)
    existing.originalPaidValue = sumMoney(existing.originalPaidValue, row.originalPaidValue)
    existing.paidValue = sumMoney(existing.paidValue, row.paidValue)
    existing.chronologicalOrder = minNumber(existing.chronologicalOrder, row.chronologicalOrder)
    existing.precatorioNumber = existing.precatorioNumber ?? row.precatorioNumber
  }

  return [...groups.values()]
}

function limitGroups(groups: GroupedPrecatorio[], maxGroups?: number | null) {
  if (!maxGroups || maxGroups < 1) {
    return groups
  }

  return groups.slice(0, Math.trunc(maxGroups))
}

function normalizeChunkSize(chunkSize?: number | null) {
  if (!chunkSize || chunkSize < 1) {
    return 500
  }

  return Math.trunc(chunkSize)
}

function chunkGroups(groups: GroupedPrecatorio[], chunkSize: number) {
  const chunks: GroupedPrecatorio[][] = []

  for (let index = 0; index < groups.length; index += chunkSize) {
    chunks.push(groups.slice(index, index + chunkSize))
  }

  return chunks
}

function debtorProfileFor(sourceRecord: SourceRecord): {
  name: string
  normalizedKey: string
  debtorType: DebtorType
  paymentRegime: PaymentRegime
} {
  const sourceKind = String(sourceRecord.rawData?.sourceKind ?? '')

  if (sourceKind === 'federal_budget') {
    return {
      name: 'Fazenda Pública Federal - TRF4',
      normalizedKey: 'FAZENDA_PUBLICA_FEDERAL_TRF4',
      debtorType: 'union',
      paymentRegime: 'federal_unique',
    }
  }

  return {
    name: 'Entidades extraorçamentárias - TRF4',
    normalizedKey: 'ENTIDADES_EXTRAORCAMENTARIAS_TRF4',
    debtorType: 'autarchy',
    paymentRegime: sourceKind === 'extra_budget_special' ? 'special' : 'other',
  }
}

function buildAssetRawData(sourceRecord: SourceRecord, group: GroupedPrecatorio): JsonRecord {
  return {
    providerId: 'trf4-chronological-precatorios',
    sourceRecordId: sourceRecord.id,
    sourceUrl: sourceRecord.sourceUrl,
    courtAlias: 'trf4',
    sourceKind: sourceRecord.rawData?.sourceKind ?? null,
    proposalYear: group.proposalYear,
    legalBasis: group.legalBasis,
    updatedUntil: group.updatedUntil,
    paidAt: group.paidAt,
    beneficiaryDocumentMasks: [
      ...new Set(group.rows.map((row) => row.beneficiaryDocumentMasked).filter(Boolean)),
    ],
    rows: group.rows.map((row) => row.rawData),
  }
}

function buildEventRawData(group: GroupedPrecatorio): JsonRecord {
  return {
    providerId: 'trf4-chronological-precatorios',
    cnjNumber: group.cnjNumber,
    proposalYear: group.proposalYear,
    chronologicalOrder: group.chronologicalOrder,
    paidAt: group.paidAt,
    paidValue: group.paidValue,
    rowCount: group.rows.length,
  }
}

function detectNature(legalBasis: string | null): AssetNature {
  const normalized = legalBasis?.toLowerCase() ?? ''

  if (normalized.includes('aliment')) {
    return 'alimentar'
  }

  return 'comum'
}

function parseBrazilianDate(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = DateTime.fromFormat(value.slice(0, 10), 'dd/LL/yyyy')
  return parsed.isValid ? parsed : null
}

function sumMoney(left: string | null, right: string | null) {
  if (left === null && right === null) {
    return null
  }

  const total = Number(left ?? 0) + Number(right ?? 0)
  return total.toFixed(2)
}

function minNumber(left: number | null, right: number | null) {
  if (left === null) {
    return right
  }

  if (right === null) {
    return left
  }

  return Math.min(left, right)
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

export default new Trf4PrecatorioImportService()
