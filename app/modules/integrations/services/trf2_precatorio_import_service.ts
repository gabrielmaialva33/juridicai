import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import AssetEvent from '#modules/precatorios/models/asset_event'
import Debtor from '#modules/debtors/models/debtor'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import Publication from '#modules/precatorios/models/publication'
import SourceRecord from '#modules/siop/models/source_record'
import { parseTrf2ChronologicalCsv, type Trf2PrecatorioRow } from './trf2_precatorio_adapter.js'
import type { AssetNature, JsonRecord } from '#shared/types/model_enums'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export type Trf2PrecatorioImportStats = {
  totalRows: number
  validRows: number
  groupedPrecatorios: number
  inserted: number
  updated: number
  skipped: number
  errors: number
}

type GroupedPrecatorio = {
  cnjNumber: string
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

class Trf2PrecatorioImportService {
  async importSourceRecord(sourceRecordId: string) {
    const sourceRecord = await SourceRecord.findOrFail(sourceRecordId)
    if (!sourceRecord.sourceFilePath) {
      throw new Error('TRF2 source record file is missing.')
    }

    const rows = parseTrf2ChronologicalCsv(await readFile(sourceRecord.sourceFilePath))
    const validRows = rows.filter((row) => row.cnjNumber)
    const groups = groupRows(validRows)
    const stats: Trf2PrecatorioImportStats = {
      totalRows: rows.length,
      validRows: validRows.length,
      groupedPrecatorios: groups.length,
      inserted: 0,
      updated: 0,
      skipped: rows.length - validRows.length,
      errors: 0,
    }

    for (const group of groups) {
      try {
        await db.transaction(async (trx) => {
          const result = await this.upsertGroup(sourceRecord, group, trx)
          stats[result] += 1
        })
      } catch {
        stats.errors += 1
      }
    }

    return { sourceRecord, stats }
  }

  private async upsertGroup(
    sourceRecord: SourceRecord,
    group: GroupedPrecatorio,
    trx: TransactionClientContract
  ) {
    const debtor = await this.findOrCreateDebtor(sourceRecord.tenantId, trx)
    const existing = await PrecatorioAsset.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('cnj_number', group.cnjNumber)
      .first()
    const rawData = buildAssetRawData(sourceRecord, group)
    const assetPayload = {
      tenantId: sourceRecord.tenantId,
      sourceRecordId: sourceRecord.id,
      source: 'tribunal' as const,
      externalId: `trf2:${group.cnjNumber}`,
      cnjNumber: group.cnjNumber,
      originProcessNumber: group.cnjNumber,
      debtorId: debtor.id,
      assetNumber: group.cnjNumber,
      exerciseYear: group.proposalYear,
      budgetYear: group.proposalYear,
      nature: detectNature(group.legalBasis),
      faceValue: group.parcelValue,
      estimatedUpdatedValue: group.paidValue ?? group.originalPaidValue ?? group.parcelValue,
      baseDate: parseTrf2Date(group.autuadoAt),
      queuePosition: group.chronologicalOrder,
      lifecycleStatus: group.paidValue ? ('paid' as const) : ('discovered' as const),
      piiStatus: 'pseudonymous' as const,
      complianceStatus: 'approved_for_analysis' as const,
      rawData,
      rowFingerprint: stableHash(rawData),
    }

    if (existing) {
      existing.useTransaction(trx)
      existing.merge(assetPayload)
      await existing.save()
      await this.upsertJudicialProcess(sourceRecord, existing, group, trx)
      await this.upsertPublication(sourceRecord, existing, group, trx)
      await this.createEvent(sourceRecord, existing.id, group, trx)
      return 'updated' as const
    }

    const asset = await PrecatorioAsset.create(assetPayload, { client: trx })
    await this.upsertJudicialProcess(sourceRecord, asset, group, trx)
    await this.upsertPublication(sourceRecord, asset, group, trx)
    await this.createEvent(sourceRecord, asset.id, group, trx)

    return 'inserted' as const
  }

  private async findOrCreateDebtor(tenantId: string, trx: TransactionClientContract) {
    const normalizedKey = 'TRIBUNAL_REGIONAL_FEDERAL_DA_2_REGIAO'
    const existing = await Debtor.query({ client: trx })
      .where('tenant_id', tenantId)
      .where('debtor_type', 'union')
      .where('state_code', 'BR')
      .where('normalized_key', normalizedKey)
      .first()

    if (existing) {
      return existing
    }

    return Debtor.create(
      {
        tenantId,
        name: 'Tribunal Regional Federal da 2ª Região',
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

  private async upsertJudicialProcess(
    sourceRecord: SourceRecord,
    asset: PrecatorioAsset,
    group: GroupedPrecatorio,
    trx: TransactionClientContract
  ) {
    const payload = {
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      source: 'tribunal' as const,
      cnjNumber: group.cnjNumber,
      courtCode: 'TRF2',
      courtName: 'Tribunal Regional Federal da 2ª Região',
      className: 'Precatório',
      subject: group.legalBasis,
      filedAt: parseTrf2Date(group.autuadoAt),
      rawData: {
        providerId: 'trf2-precatorios',
        courtAlias: 'trf2',
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

  private async upsertPublication(
    sourceRecord: SourceRecord,
    asset: PrecatorioAsset,
    group: GroupedPrecatorio,
    trx: TransactionClientContract
  ) {
    const publicationDate = publicationDateFor(group)
    const body = `TRF2 paid precatorio ${group.cnjNumber} in proposal ${group.proposalYear ?? 'unknown'}.`
    const textHash = stableHash({
      providerId: 'trf2-precatorios',
      cnjNumber: group.cnjNumber,
      sourceRecordId: sourceRecord.id,
    })
    const existing = await Publication.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('source', 'tribunal')
      .where('text_hash', textHash)
      .where('publication_date', publicationDate.toFormat('yyyy-LL-dd'))
      .first()

    if (existing) {
      existing.useTransaction(trx)
      existing.merge({
        assetId: asset.id,
        sourceRecordId: sourceRecord.id,
        title: 'TRF2 paid precatorio',
        body,
        rawData: buildPublicationRawData(group),
      })
      await existing.save()
      return existing
    }

    return Publication.create(
      {
        tenantId: sourceRecord.tenantId,
        assetId: asset.id,
        sourceRecordId: sourceRecord.id,
        source: 'tribunal',
        publicationDate,
        title: 'TRF2 paid precatorio',
        body,
        textHash,
        rawData: buildPublicationRawData(group),
      },
      { client: trx }
    )
  }

  private async createEvent(
    sourceRecord: SourceRecord,
    assetId: string,
    group: GroupedPrecatorio,
    trx: TransactionClientContract
  ) {
    const idempotencyKey = `trf2:${sourceRecord.id}:${group.cnjNumber}`
    const existing = await AssetEvent.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('asset_id', assetId)
      .where('event_type', 'trf2_imported')
      .where('idempotency_key', idempotencyKey)
      .first()

    if (existing) {
      return existing
    }

    return AssetEvent.create(
      {
        tenantId: sourceRecord.tenantId,
        assetId,
        eventType: 'trf2_imported',
        eventDate: DateTime.now(),
        source: 'tribunal',
        payload: buildPublicationRawData(group),
        idempotencyKey,
      },
      { client: trx }
    )
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
  }

  return [...groups.values()]
}

function buildAssetRawData(sourceRecord: SourceRecord, group: GroupedPrecatorio): JsonRecord {
  return {
    providerId: 'trf2-precatorios',
    sourceRecordId: sourceRecord.id,
    sourceUrl: sourceRecord.sourceUrl,
    courtAlias: 'trf2',
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

function buildPublicationRawData(group: GroupedPrecatorio): JsonRecord {
  return {
    providerId: 'trf2-precatorios',
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

function parseTrf2Date(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = DateTime.fromFormat(value.slice(0, 10), 'dd/LL/yyyy')
  return parsed.isValid ? parsed : null
}

function publicationDateFor(group: GroupedPrecatorio) {
  return parseMonthYear(group.paidAt) ?? parseTrf2Date(group.autuadoAt) ?? DateTime.now()
}

function parseMonthYear(value: string | null) {
  if (!value) {
    return null
  }

  const match = value
    .trim()
    .toLowerCase()
    .match(/^([a-zç]{3})\/(\d{2})$/)
  if (!match) {
    return null
  }

  const month = MONTHS[match[1]]
  const year = Number(`20${match[2]}`)

  if (!month || !Number.isFinite(year)) {
    return null
  }

  return DateTime.fromObject({ year, month, day: 1 })
}

const MONTHS: Record<string, number> = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
}

function sumMoney(left: string | null, right: string | null) {
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

export default new Trf2PrecatorioImportService()
