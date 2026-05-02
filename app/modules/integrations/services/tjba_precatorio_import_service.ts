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
import SourceRecord from '#modules/siop/models/source_record'
import { normalizeCnj } from '#modules/siop/parsers/cnj_parser'
import { normalizeDebtorName } from '#modules/siop/parsers/debtor_normalizer'
import type { AssetNature, DebtorType, JsonRecord, PaymentRegime } from '#shared/types/model_enums'
import type {
  TjbaPrecatorioApiPagePayload,
  TjbaPrecatorioApiRow,
} from '#modules/integrations/services/tjba_precatorio_api_adapter'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export type TjbaPrecatorioImportOptions = {
  maxRows?: number | null
}

export type TjbaPrecatorioImportStats = {
  totalRows: number
  validRows: number
  selectedRows: number
  inserted: number
  updated: number
  skipped: number
  errors: number
}

type TjbaImportRow = {
  apiRow: TjbaPrecatorioApiRow
  rowNumber: number
  externalId: string
  cnjNumber: string | null
  debtorName: string
  debtorType: DebtorType
  paymentRegime: PaymentRegime
  nature: AssetNature
  assetNumber: string
  exerciseYear: number | null
  expeditionDate: DateTime | null
  faceValue: string | null
  queuePosition: number | null
  isPriority: boolean
  rowFingerprint: string
  rawData: JsonRecord
}

type ImportContext = {
  courtId: string | null
  judicialClassId: string | null
}

class TjbaPrecatorioImportService {
  async importSourceRecord(sourceRecordId: string, options: TjbaPrecatorioImportOptions = {}) {
    const sourceRecord = await SourceRecord.findOrFail(sourceRecordId)
    const payload = await readPayload(sourceRecord)
    const debtorNamesByCode = debtorNamesFromRawData(sourceRecord.rawData)
    const rows = flattenRows(payload)
    const importRows = rows
      .map((row, index) => buildImportRow(row, index + 1, debtorNamesByCode))
      .filter((row): row is TjbaImportRow => row !== null)
    const selectedRows = limitRows(importRows, options.maxRows)
    const context = await this.buildContext()
    const stats: TjbaPrecatorioImportStats = {
      totalRows: rows.length,
      validRows: importRows.length,
      selectedRows: selectedRows.length,
      inserted: 0,
      updated: 0,
      skipped: rows.length - importRows.length,
      errors: 0,
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
      stats,
    }
  }

  private async buildContext(): Promise<ImportContext> {
    const court = await referenceCatalogService.court({
      code: 'TJBA',
      alias: 'tjba',
      name: 'Tribunal de Justiça do Estado da Bahia',
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
    row: TjbaImportRow,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
    const debtor = await this.findOrCreateDebtor(sourceRecord, row, trx)
    const existing = await PrecatorioAsset.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where((builder) => {
        if (row.cnjNumber) {
          builder.where('cnj_number', row.cnjNumber).orWhere('external_id', row.externalId)
          return
        }

        builder.where('external_id', row.externalId)
      })
      .first()
    const payload = {
      tenantId: sourceRecord.tenantId,
      sourceRecordId: sourceRecord.id,
      source: 'tribunal' as const,
      externalId: row.externalId,
      cnjNumber: row.cnjNumber,
      originProcessNumber: row.cnjNumber ?? row.assetNumber,
      debtorId: debtor.id,
      courtId: context.courtId,
      assetNumber: row.assetNumber,
      exerciseYear: row.exerciseYear,
      budgetYear: row.exerciseYear,
      nature: row.nature,
      originFiledAt: row.expeditionDate,
      lifecycleStatus: 'discovered' as const,
      piiStatus: row.apiRow.deBeneficiario ? ('materialized' as const) : ('pseudonymous' as const),
      complianceStatus: 'approved_for_analysis' as const,
      rawData: buildAssetRawData(sourceRecord, row),
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
    row: TjbaImportRow,
    trx: TransactionClientContract
  ) {
    const normalizedKey = normalizeDebtorName(row.debtorName) ?? normalizeKey(row.debtorName)
    const existing = await Debtor.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('normalized_key', normalizedKey)
      .where('state_code', 'BA')
      .first()

    if (existing) {
      return existing
    }

    return Debtor.create(
      {
        tenantId: sourceRecord.tenantId,
        name: row.debtorName,
        normalizedName: normalizedKey,
        normalizedKey,
        debtorType: row.debtorType,
        cnpj: null,
        stateCode: 'BA',
        paymentRegime: row.paymentRegime,
      },
      { client: trx }
    )
  }

  private async upsertRelatedRecords(
    sourceRecord: SourceRecord,
    asset: PrecatorioAsset,
    row: TjbaImportRow,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
    await this.upsertValuation(sourceRecord, asset.id, row, trx)
    await this.upsertBudgetFact(sourceRecord, asset.id, row, trx)
    await this.upsertJudicialProcess(sourceRecord, asset, row, context, trx)
    await this.upsertImportEvent(sourceRecord, asset.id, row, trx)
    await this.recordEvidence(sourceRecord, asset, row, trx)
  }

  private async upsertValuation(
    sourceRecord: SourceRecord,
    assetId: string,
    row: TjbaImportRow,
    trx: TransactionClientContract
  ) {
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
      baseDate: row.expeditionDate,
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
    row: TjbaImportRow,
    trx: TransactionClientContract
  ) {
    const existing = await AssetBudgetFact.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('asset_id', assetId)
      .where('source_record_id', sourceRecord.id)
      .whereRaw("raw_data->>'rowFingerprint' = ?", [row.rowFingerprint])
      .first()
    const payload = {
      tenantId: sourceRecord.tenantId,
      assetId,
      exerciseYear: row.exerciseYear,
      budgetYear: row.exerciseYear,
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
    row: TjbaImportRow,
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
      courtAlias: 'tjba',
      filedAt: row.expeditionDate,
      rawData: {
        providerId: 'tjba-precatorio-api',
        sourceRecordId: sourceRecord.id,
        rowFingerprint: row.rowFingerprint,
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
    row: TjbaImportRow,
    trx: TransactionClientContract
  ) {
    const idempotencyKey = `tjba-api:${sourceRecord.id}:${row.rowFingerprint}`
    const existing = await AssetEvent.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('asset_id', assetId)
      .where('event_type', 'tjba_api_imported')
      .where('idempotency_key', idempotencyKey)
      .first()

    if (existing) {
      return existing
    }

    return AssetEvent.create(
      {
        tenantId: sourceRecord.tenantId,
        assetId,
        eventType: 'tjba_api_imported',
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
    row: TjbaImportRow,
    trx: TransactionClientContract
  ) {
    await sourceEvidenceService.linkAsset({
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: 'court-annual-map-pages',
      linkType: 'primary',
      confidence: row.cnjNumber ? 0.98 : 0.75,
      matchReason: row.cnjNumber ? 'tjba_api_cnj_match' : 'tjba_api_precatorio_number',
      matchedFields: {
        cnjNumber: row.cnjNumber,
        assetNumber: row.assetNumber,
        cdEntidadeDevedora: row.apiRow.cdEntidadeDevedora ?? null,
        rowFingerprint: row.rowFingerprint,
      },
      normalizedPayload: {
        debtorName: row.debtorName,
        value: row.faceValue,
        queuePosition: row.queuePosition,
        nature: row.nature,
      },
      rawPointer: {
        sourceRecordId: sourceRecord.id,
        rowNumber: row.rowNumber,
        rowFingerprint: row.rowFingerprint,
      },
      trx,
    })

    await sourceEvidenceService.upsertIdentifier({
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: 'court-annual-map-pages',
      identifierType: 'precatorio_number',
      identifierValue: row.assetNumber,
      issuer: 'TJBA',
      isPrimary: !row.cnjNumber,
      rawData: row.rawData,
      trx,
    })

    await sourceEvidenceService.upsertIdentifier({
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: 'court-annual-map-pages',
      identifierType: 'cnj_number',
      identifierValue: row.cnjNumber,
      issuer: 'TJBA',
      isPrimary: true,
      rawData: row.rawData,
      trx,
    })
  }
}

async function readPayload(sourceRecord: SourceRecord): Promise<TjbaPrecatorioApiPagePayload> {
  if (!sourceRecord.sourceFilePath) {
    throw new Error(`Source record ${sourceRecord.id} has no stored TJBA API payload.`)
  }

  return JSON.parse(
    await readFile(sourceRecord.sourceFilePath, 'utf8')
  ) as TjbaPrecatorioApiPagePayload
}

function flattenRows(payload: TjbaPrecatorioApiPagePayload) {
  return payload.content.flatMap((entity) => entity.listaPrecatorio ?? [])
}

function buildImportRow(
  row: TjbaPrecatorioApiRow,
  rowNumber: number,
  debtorNamesByCode: Record<string, string>
): TjbaImportRow | null {
  if (!row.cdPrecatorio) {
    return null
  }

  const cnjNumber = normalizeTjbaPrecatorioNumber(row.cdPrecatorio)
  const debtorName = debtorNameFor(row, debtorNamesByCode)
  const rawData = {
    providerId: 'tjba-precatorio-api',
    rowNumber,
    courtAlias: 'tjba',
    stateCode: 'BA',
    row,
  } satisfies JsonRecord
  const rowFingerprint = stableHash(rawData)

  return {
    apiRow: row,
    rowNumber,
    externalId: `tjba:${row.cdPrecatorio}`,
    cnjNumber,
    debtorName,
    ...debtorProfileFor(debtorName),
    nature: natureFor(row),
    assetNumber: row.cdPrecatorio,
    exerciseYear: numberOrNull(row.nuAnoOrcamento),
    expeditionDate: dateFromApi(row.dtExpedicao) ?? dateFromBrazilian(row.dataExp),
    faceValue: moneyFromNumber(row.valorDevido),
    queuePosition: numberOrNull(row.ordemCronologica),
    isPriority: Boolean(row.flagPrioridade || row.flprioridade === 1),
    rowFingerprint,
    rawData,
  }
}

function debtorNameFor(row: TjbaPrecatorioApiRow, debtorNamesByCode: Record<string, string>) {
  if (row.deEntidadeDevedora?.trim()) {
    return row.deEntidadeDevedora.trim()
  }

  const debtorCode = row.cdEntidadeDevedora ? String(row.cdEntidadeDevedora) : null
  if (debtorCode && debtorNamesByCode[debtorCode]) {
    return debtorNamesByCode[debtorCode]
  }

  return debtorCode ? `TJBA debtor ${debtorCode}` : 'TJBA debtor not identified'
}

function normalizeTjbaPrecatorioNumber(value: string | null | undefined) {
  const direct = normalizeCnj(value)

  if (direct || !value) {
    return direct
  }

  const match = value.match(/^(\d{7}-\d{2}\.\d{4}\.)(\d)(\d{2})(\.\d{4})-\d$/)
  if (!match) {
    return null
  }

  return normalizeCnj(`${match[1]}${match[2]}.${match[3]}${match[4]}`)
}

function debtorProfileFor(name: string): { debtorType: DebtorType; paymentRegime: PaymentRegime } {
  const normalized = normalizeKey(name)

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

  if (
    normalized.includes('INSTITUTO') ||
    normalized.includes('DEPARTAMENTO') ||
    normalized.includes('AUTARQUIA') ||
    normalized.includes('EMBASA')
  ) {
    return { debtorType: 'autarchy', paymentRegime: 'special' }
  }

  return { debtorType: 'state', paymentRegime: 'special' }
}

function natureFor(row: TjbaPrecatorioApiRow): AssetNature {
  const value = normalizeKey(`${row.cdNatureza ?? ''} ${row.siglaCdNatureza ?? ''}`)

  if (value.includes('A')) return 'alimentar'
  if (value.includes('C')) return 'comum'
  return 'unknown'
}

function buildAssetRawData(sourceRecord: SourceRecord, row: TjbaImportRow): JsonRecord {
  return {
    providerId: 'tjba-precatorio-api',
    sourceRecordId: sourceRecord.id,
    sourceUrl: sourceRecord.sourceUrl,
    courtAlias: 'tjba',
    stateCode: 'BA',
    rowNumber: row.rowNumber,
    rowFingerprint: row.rowFingerprint,
    isPriority: row.isPriority,
    beneficiaryName: row.apiRow.deBeneficiario ?? null,
    row: row.apiRow,
  }
}

function buildValuationRawData(row: TjbaImportRow): JsonRecord {
  return {
    providerId: 'tjba-precatorio-api',
    rowFingerprint: row.rowFingerprint,
    value: row.faceValue,
    queuePosition: row.queuePosition,
    sourceValue: row.apiRow.valor ?? null,
    row: row.apiRow,
  }
}

function buildBudgetFactRawData(row: TjbaImportRow): JsonRecord {
  return {
    providerId: 'tjba-precatorio-api',
    rowFingerprint: row.rowFingerprint,
    exerciseYear: row.exerciseYear,
    unitCode: row.apiRow.deUnidadeRequisitante ?? null,
    row: row.apiRow,
  }
}

function debtorNamesFromRawData(rawData: JsonRecord | null) {
  const value = rawData?.debtorNamesByCode
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, string>
}

function limitRows<T>(rows: T[], limit?: number | null) {
  if (!limit || limit < 1) {
    return rows
  }

  return rows.slice(0, Math.trunc(limit))
}

function dateFromApi(value: number[] | null | undefined) {
  if (!Array.isArray(value) || value.length < 3) {
    return null
  }

  const [year, month, day] = value
  const parsed = DateTime.fromObject({ year, month, day })
  return parsed.isValid ? parsed : null
}

function dateFromBrazilian(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = DateTime.fromFormat(value, 'dd/MM/yyyy')
  return parsed.isValid ? parsed : null
}

function moneyFromNumber(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return value.toFixed(2)
}

function numberOrNull(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

function normalizeKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
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

export default new TjbaPrecatorioImportService()
