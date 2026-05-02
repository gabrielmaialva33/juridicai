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
  TjesLupDebtorApiRow,
  TjesLupPrecatorioApiPagePayload,
  TjesLupPrecatorioApiRow,
} from '#modules/integrations/services/tjes_lup_precatorio_api_adapter'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export type TjesLupPrecatorioImportOptions = {
  maxRows?: number | null
}

export type TjesLupPrecatorioImportStats = {
  totalRows: number
  validRows: number
  selectedRows: number
  inserted: number
  updated: number
  skipped: number
  errors: number
}

type TjesLupImportRow = {
  apiRow: TjesLupPrecatorioApiRow
  rowNumber: number
  externalId: string
  cnjNumber: string | null
  originProcessNumber: string | null
  debtorName: string
  debtorType: DebtorType
  paymentRegime: PaymentRegime
  nature: AssetNature
  assetNumber: string
  exerciseYear: number | null
  expeditionDate: DateTime | null
  decisionDate: DateTime | null
  importDate: DateTime | null
  updatedAt: DateTime | null
  faceValue: string | null
  queuePosition: number | null
  isPriorityByDisease: boolean
  isPriorityByAge: boolean
  rowFingerprint: string
  rawData: JsonRecord
}

type ImportContext = {
  courtId: string | null
  judicialClassId: string | null
}

class TjesLupPrecatorioImportService {
  async importSourceRecord(sourceRecordId: string, options: TjesLupPrecatorioImportOptions = {}) {
    const sourceRecord = await SourceRecord.findOrFail(sourceRecordId)
    const payload = await readPayload(sourceRecord)
    const debtor = debtorFromRawData(sourceRecord.rawData)
    const importRows = payload.results
      .map((row, index) => buildImportRow(row, index + 1, debtor))
      .filter((row): row is TjesLupImportRow => row !== null)
    const selectedRows = limitRows(importRows, options.maxRows)
    const context = await this.buildContext()
    const stats: TjesLupPrecatorioImportStats = {
      totalRows: payload.results.length,
      validRows: importRows.length,
      selectedRows: selectedRows.length,
      inserted: 0,
      updated: 0,
      skipped: payload.results.length - importRows.length,
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
      code: 'TJES',
      alias: 'tjes',
      name: 'Tribunal de Justiça do Estado do Espírito Santo',
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
    row: TjesLupImportRow,
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
      originProcessNumber: row.originProcessNumber,
      debtorId: debtor.id,
      courtId: context.courtId,
      assetNumber: row.assetNumber,
      exerciseYear: row.exerciseYear,
      budgetYear: row.exerciseYear,
      nature: row.nature,
      originFiledAt: row.expeditionDate,
      lifecycleStatus: 'discovered' as const,
      piiStatus: row.apiRow.de_beneficiario ? ('materialized' as const) : ('pseudonymous' as const),
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
    row: TjesLupImportRow,
    trx: TransactionClientContract
  ) {
    const normalizedKey = normalizeDebtorName(row.debtorName) ?? normalizeKey(row.debtorName)
    const existing = await Debtor.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('normalized_key', normalizedKey)
      .where('state_code', 'ES')
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
        stateCode: 'ES',
        paymentRegime: row.paymentRegime,
      },
      { client: trx }
    )
  }

  private async upsertRelatedRecords(
    sourceRecord: SourceRecord,
    asset: PrecatorioAsset,
    row: TjesLupImportRow,
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
    row: TjesLupImportRow,
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
      baseDate: row.updatedAt ?? row.expeditionDate,
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
    row: TjesLupImportRow,
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
    row: TjesLupImportRow,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
    const processNumber = row.originProcessNumber ?? row.cnjNumber
    if (!processNumber) {
      return null
    }

    const existing = await JudicialProcess.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('cnj_number', processNumber)
      .first()
    const payload = {
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      source: 'tribunal' as const,
      cnjNumber: processNumber,
      courtId: context.courtId,
      classId: context.judicialClassId,
      courtAlias: 'tjes',
      filedAt: row.decisionDate ?? row.expeditionDate,
      rawData: {
        providerId: 'tjes-lup-api',
        sourceRecordId: sourceRecord.id,
        rowFingerprint: row.rowFingerprint,
        precatorioCnjNumber: row.cnjNumber,
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
    row: TjesLupImportRow,
    trx: TransactionClientContract
  ) {
    const idempotencyKey = `tjes-lup-api:${sourceRecord.id}:${row.rowFingerprint}`
    const existing = await AssetEvent.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('asset_id', assetId)
      .where('event_type', 'tjes_lup_api_imported')
      .where('idempotency_key', idempotencyKey)
      .first()

    if (existing) {
      return existing
    }

    return AssetEvent.create(
      {
        tenantId: sourceRecord.tenantId,
        assetId,
        eventType: 'tjes_lup_api_imported',
        eventDate: row.importDate ?? DateTime.now(),
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
    row: TjesLupImportRow,
    trx: TransactionClientContract
  ) {
    await sourceEvidenceService.linkAsset({
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: 'court-annual-map-pages',
      linkType: 'primary',
      confidence: row.cnjNumber ? 0.98 : 0.75,
      matchReason: row.cnjNumber ? 'tjes_lup_api_cnj_match' : 'tjes_lup_precatorio_number',
      matchedFields: {
        cnjNumber: row.cnjNumber,
        originProcessNumber: row.originProcessNumber,
        assetNumber: row.assetNumber,
        debtorCode: row.apiRow.cd_entidade_devedora ?? null,
        rowFingerprint: row.rowFingerprint,
      },
      normalizedPayload: {
        debtorName: row.debtorName,
        value: row.faceValue,
        queuePosition: row.queuePosition,
        nature: row.nature,
        isPriorityByAge: row.isPriorityByAge,
        isPriorityByDisease: row.isPriorityByDisease,
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
      issuer: 'TJES',
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
      issuer: 'TJES',
      isPrimary: true,
      rawData: row.rawData,
      trx,
    })

    await sourceEvidenceService.upsertIdentifier({
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: 'court-annual-map-pages',
      identifierType: 'origin_process_number',
      identifierValue: row.originProcessNumber,
      issuer: 'TJES',
      isPrimary: false,
      rawData: row.rawData,
      trx,
    })
  }
}

async function readPayload(sourceRecord: SourceRecord): Promise<TjesLupPrecatorioApiPagePayload> {
  if (!sourceRecord.sourceFilePath) {
    throw new Error(`Source record ${sourceRecord.id} has no stored TJES LUP API payload.`)
  }

  return JSON.parse(
    await readFile(sourceRecord.sourceFilePath, 'utf8')
  ) as TjesLupPrecatorioApiPagePayload
}

function buildImportRow(
  row: TjesLupPrecatorioApiRow,
  rowNumber: number,
  sourceDebtor: TjesLupDebtorApiRow | null
): TjesLupImportRow | null {
  const assetNumber = row.cd_precatorio_original ?? row.cd_precatorio
  if (!assetNumber) {
    return null
  }

  const debtorName = debtorNameFor(row, sourceDebtor)
  const rawData = {
    providerId: 'tjes-lup-api',
    rowNumber,
    courtAlias: 'tjes',
    stateCode: 'ES',
    sourceDebtor,
    row,
  } satisfies JsonRecord
  const rowFingerprint = stableHash(rawData)

  return {
    apiRow: row,
    rowNumber,
    externalId: `tjes-lup:${row.cd_entidade_devedora ?? 'unknown'}:${assetNumber}`,
    cnjNumber: normalizeCnj(assetNumber),
    originProcessNumber: normalizeCnj(row.nu_acao),
    debtorName,
    ...debtorProfileFor(debtorName, sourceDebtor),
    nature: natureFor(row),
    assetNumber,
    exerciseYear: numberOrNull(row.nu_ano_orcamento),
    expeditionDate: dateFromIso(row.dt_expedicao),
    decisionDate: dateFromIso(row.dt_decisao),
    importDate: dateFromIso(row.dt_importacao),
    updatedAt: dateFromIso(row.dt_atualizacao),
    faceValue: moneyFromNumber(row.vl_atualizado),
    queuePosition: numberOrNull(row.ordem),
    isPriorityByDisease: Boolean(row.is_prioritario_doenca),
    isPriorityByAge: Boolean(row.is_prioritario_idade),
    rowFingerprint,
    rawData,
  }
}

function debtorNameFor(row: TjesLupPrecatorioApiRow, sourceDebtor: TjesLupDebtorApiRow | null) {
  if (row.de_entidade_devedora?.trim()) {
    return row.de_entidade_devedora.trim()
  }

  if (sourceDebtor?.de_nome_entidade?.trim()) {
    return sourceDebtor.de_nome_entidade.trim()
  }

  const debtorCode = row.cd_entidade_devedora ? String(row.cd_entidade_devedora) : null
  return debtorCode ? `TJES debtor ${debtorCode}` : 'TJES debtor not identified'
}

function debtorProfileFor(
  name: string,
  sourceDebtor: TjesLupDebtorApiRow | null
): { debtorType: DebtorType; paymentRegime: PaymentRegime } {
  const normalized = normalizeKey(name)
  const paymentRegime: PaymentRegime = sourceDebtor?.fl_regime_especial === 'S' ? 'special' : 'none'

  if (normalized.includes('INSS')) {
    return { debtorType: 'autarchy', paymentRegime: 'federal_unique' }
  }

  if (
    normalized.includes('MUNICIP') ||
    normalized.includes('PREFEITURA') ||
    normalized.includes('CAMARA')
  ) {
    return { debtorType: 'municipality', paymentRegime }
  }

  if (normalized.includes('FUNDACAO')) {
    return { debtorType: 'foundation', paymentRegime }
  }

  if (
    normalized.includes('INSTITUTO') ||
    normalized.includes('DEPARTAMENTO') ||
    normalized.includes('AUTARQUIA') ||
    normalized.includes('COMPANHIA')
  ) {
    return { debtorType: 'autarchy', paymentRegime }
  }

  return { debtorType: 'state', paymentRegime }
}

function natureFor(row: TjesLupPrecatorioApiRow): AssetNature {
  const value = normalizeKey(row.cd_natureza ?? '')

  if (value.includes('A')) return 'alimentar'
  if (value.includes('C')) return 'comum'
  return 'unknown'
}

function buildAssetRawData(sourceRecord: SourceRecord, row: TjesLupImportRow): JsonRecord {
  return {
    providerId: 'tjes-lup-api',
    sourceRecordId: sourceRecord.id,
    sourceUrl: sourceRecord.sourceUrl,
    courtAlias: 'tjes',
    stateCode: 'ES',
    rowNumber: row.rowNumber,
    rowFingerprint: row.rowFingerprint,
    isPriorityByAge: row.isPriorityByAge,
    isPriorityByDisease: row.isPriorityByDisease,
    beneficiaryName: row.apiRow.de_beneficiario ?? null,
    row: row.apiRow,
  }
}

function buildValuationRawData(row: TjesLupImportRow): JsonRecord {
  return {
    providerId: 'tjes-lup-api',
    rowFingerprint: row.rowFingerprint,
    value: row.faceValue,
    queuePosition: row.queuePosition,
    sourceValue: row.apiRow.vl_atualizado ?? null,
    endOfYearValue: row.apiRow.vl_fim_exercicio ?? null,
    priorityDiseaseValue: row.apiRow.vl_prioritario_doenca ?? null,
    priorityAgeValue: row.apiRow.vl_prioritario_idade ?? null,
    row: row.apiRow,
  }
}

function buildBudgetFactRawData(row: TjesLupImportRow): JsonRecord {
  return {
    providerId: 'tjes-lup-api',
    rowFingerprint: row.rowFingerprint,
    exerciseYear: row.exerciseYear,
    requestingUnit: row.apiRow.de_unidade_requisitante ?? null,
    exportCode: row.apiRow.cd_exportacao ?? null,
    row: row.apiRow,
  }
}

function debtorFromRawData(rawData: JsonRecord | null): TjesLupDebtorApiRow | null {
  const value = rawData?.debtor
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as TjesLupDebtorApiRow
}

function limitRows<T>(rows: T[], limit?: number | null) {
  if (!limit || limit < 1) {
    return rows
  }

  return rows.slice(0, Math.trunc(limit))
}

function dateFromIso(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = DateTime.fromISO(value)
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

export default new TjesLupPrecatorioImportService()
