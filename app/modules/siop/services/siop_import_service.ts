import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { DateTime } from 'luxon'
import ExcelJS from 'exceljs'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import siopImportRepository from '#modules/siop/repositories/siop_import_repository'
import siopNormalizeService from '#modules/siop/services/siop_normalize_service'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetScore from '#modules/precatorios/models/asset_score'
import Debtor from '#modules/debtors/models/debtor'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import SiopImport from '#modules/siop/models/siop_import'
import SiopStagingRow from '#modules/siop/models/siop_staging_row'
import SourceRecord from '#modules/siop/models/source_record'
import type { AssetNature, DebtorType, ImportStatus, JsonRecord } from '#shared/types/model_enums'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

const IMPORT_CHUNK_SIZE = 1_000

type SiopImportRowsPayload = {
  tenantId: string
  exerciseYear: number
  rows: JsonRecord[]
  source?: {
    checksum?: string | null
    originalFilename?: string | null
    mimeType?: string | null
    fileSizeBytes?: number | bigint | null
    filePath?: string | null
    url?: string | null
    metadata?: JsonRecord | null
  }
  uploadedByUserId?: string | null
}

type SiopImportFilePayload = {
  tenantId: string
  exerciseYear: number
  buffer: Buffer
  originalFilename: string
  mimeType?: string | null
  fileSizeBytes?: number | bigint | null
  uploadedByUserId?: string | null
}

export type ImportStats = {
  totalRows: number
  inserted: number
  updated: number
  skipped: number
  errors: number
}

export type SiopImportResult = {
  import: SiopImport
  stats: ImportStats
  skipped?: boolean
  reason?: 'already_running'
}

class SiopImportService {
  listRecentImports(tenantId: string) {
    return siopImportRepository.listRecent(tenantId)
  }

  async createPendingFileImport(payload: SiopImportFilePayload) {
    const checksum = createHash('sha256').update(payload.buffer).digest('hex')
    const filePath = await persistSourceFile({
      tenantId: payload.tenantId,
      checksum,
      originalFilename: payload.originalFilename,
      buffer: payload.buffer,
    })

    const sourceRecord = await this.findOrCreateSourceRecord(
      {
        tenantId: payload.tenantId,
        exerciseYear: payload.exerciseYear,
        rows: [],
        uploadedByUserId: payload.uploadedByUserId ?? null,
        source: {
          checksum,
          originalFilename: payload.originalFilename,
          mimeType: payload.mimeType ?? null,
          fileSizeBytes: payload.fileSizeBytes ?? payload.buffer.byteLength,
          filePath,
          metadata: {
            parser: detectParser(payload.originalFilename),
          },
        },
      },
      checksum
    )
    const existingImport = await this.findExistingImport(
      payload.tenantId,
      payload.exerciseYear,
      sourceRecord.id
    )
    const siopImport =
      existingImport ??
      (await this.createImport(
        {
          tenantId: payload.tenantId,
          exerciseYear: payload.exerciseYear,
          uploadedByUserId: payload.uploadedByUserId ?? null,
          source: {
            metadata: {
              parser: detectParser(payload.originalFilename),
            },
          },
        },
        sourceRecord.id
      ))

    return {
      import: siopImport,
      sourceRecord,
      checksum,
      created: !existingImport,
    }
  }

  async importRows(payload: SiopImportRowsPayload): Promise<SiopImportResult> {
    const checksum = payload.source?.checksum ?? checksumRows(payload.rows)
    const sourceRecord = await this.findOrCreateSourceRecord(payload, checksum)
    const siopImport = await this.findOrCreateImport(payload, sourceRecord.id)

    const stats: ImportStats = {
      totalRows: payload.rows.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    }

    const started = await this.tryStartImport(siopImport)
    if (!started) {
      return {
        import: siopImport,
        stats: {
          ...stats,
          skipped: payload.rows.length,
        },
        skipped: true,
        reason: 'already_running',
      }
    }

    for (const rows of chunkRows(payload.rows, IMPORT_CHUNK_SIZE)) {
      await db.transaction(async (trx) => {
        for (const row of rows) {
          await this.processRow({
            row,
            payload,
            siopImport,
            sourceRecordId: sourceRecord.id,
            stats,
            trx,
          })
        }
      })
    }

    siopImport.merge({
      status:
        stats.errors > 0
          ? stats.inserted + stats.updated > 0
            ? 'partial'
            : 'failed'
          : 'completed',
      finishedAt: DateTime.now(),
      totalRows: stats.totalRows,
      inserted: stats.inserted,
      updated: stats.updated,
      skipped: stats.skipped,
      errors: stats.errors,
      rawMetadata: {
        ...(payload.source?.metadata ?? {}),
        checksum,
      },
    })
    await siopImport.save()

    return { import: siopImport, stats }
  }

  async importFile(payload: SiopImportFilePayload) {
    const checksum = createHash('sha256').update(payload.buffer).digest('hex')
    const filePath = await persistSourceFile({
      tenantId: payload.tenantId,
      checksum,
      originalFilename: payload.originalFilename,
      buffer: payload.buffer,
    })
    const rows = await parseSiopRows(payload.buffer, payload.originalFilename)

    return this.importRows({
      tenantId: payload.tenantId,
      exerciseYear: payload.exerciseYear,
      rows,
      uploadedByUserId: payload.uploadedByUserId ?? null,
      source: {
        checksum,
        originalFilename: payload.originalFilename,
        mimeType: payload.mimeType ?? null,
        fileSizeBytes: payload.fileSizeBytes ?? payload.buffer.byteLength,
        filePath,
        metadata: {
          parser: detectParser(payload.originalFilename),
        },
      },
    })
  }

  async processImportFile(importId: string) {
    const siopImport = await SiopImport.query()
      .where('id', importId)
      .preload('sourceRecord')
      .firstOrFail()

    if (!siopImport.sourceRecord.sourceFilePath) {
      throw new Error('SIOP import source file is missing.')
    }

    const buffer = await readFile(siopImport.sourceRecord.sourceFilePath)
    const checksum =
      siopImport.sourceRecord.sourceChecksum ?? createHash('sha256').update(buffer).digest('hex')
    const rows = await parseSiopRows(
      buffer,
      siopImport.sourceRecord.originalFilename ?? `siop-${siopImport.id}.xlsx`
    )

    return this.importRows({
      tenantId: siopImport.tenantId,
      exerciseYear: siopImport.exerciseYear,
      uploadedByUserId: siopImport.uploadedByUserId,
      rows,
      source: {
        checksum,
        originalFilename: siopImport.sourceRecord.originalFilename,
        mimeType: siopImport.sourceRecord.mimeType,
        fileSizeBytes: siopImport.sourceRecord.fileSizeBytes,
        filePath: siopImport.sourceRecord.sourceFilePath,
        metadata: {
          ...(siopImport.sourceRecord.rawData ?? {}),
          parser: detectParser(siopImport.sourceRecord.originalFilename ?? ''),
        },
      },
    })
  }

  private async processRow(input: {
    row: JsonRecord
    payload: SiopImportRowsPayload
    siopImport: SiopImport
    sourceRecordId: string
    stats: ImportStats
    trx: TransactionClientContract
  }) {
    const normalized = siopNormalizeService.normalizeRow(input.row)
    const errors = this.validateNormalizedRow(normalized)

    const stagingRow = await SiopStagingRow.create(
      {
        importId: input.siopImport.id,
        rawData: input.row,
        normalizedCnj: normalized.cnjNumber,
        normalizedDebtorKey: normalized.debtorName,
        normalizedValue: normalized.faceValue,
        normalizedYear: normalized.exerciseYear ?? input.payload.exerciseYear,
        validationStatus: errors.length > 0 ? 'invalid' : 'valid',
        errors: errors.length > 0 ? { messages: errors } : null,
        processedAt: DateTime.now(),
      },
      { client: input.trx }
    )

    if (errors.length > 0) {
      input.stats.errors += 1
      input.stats.skipped += 1
      return stagingRow
    }

    const debtor = await this.findOrCreateDebtor(
      input.payload.tenantId,
      input.row,
      normalized.debtorName!,
      input.trx
    )
    const fingerprint = rowFingerprint(input.row)
    const externalId =
      extractString(input.row, ['chave', 'external_id', 'externalId', 'id', 'asset_id']) ??
      fingerprint
    const existingAsset = await this.findExistingAsset(
      input.payload.tenantId,
      normalized.cnjNumber,
      externalId,
      input.trx
    )

    if (existingAsset) {
      existingAsset.useTransaction(input.trx)
      existingAsset.merge({
        sourceRecordId: input.sourceRecordId,
        debtorId: debtor.id,
        externalId,
        originProcessNumber: normalized.cnjNumber,
        assetNumber: extractString(input.row, [
          'chave',
          'asset_number',
          'numero_precatorio',
          'precatorio',
        ]),
        exerciseYear: normalized.exerciseYear ?? input.payload.exerciseYear,
        budgetYear: normalized.exerciseYear ?? input.payload.exerciseYear,
        nature: detectAssetNature(input.row),
        faceValue: normalized.faceValue,
        estimatedUpdatedValue: normalized.updatedValue ?? normalized.faceValue,
        lifecycleStatus: 'discovered',
        complianceStatus: 'approved_for_analysis',
        rawData: input.row,
        rowFingerprint: fingerprint,
      })
      await existingAsset.save()
      input.stats.updated += 1
      await this.createImportEvent(
        input.payload.tenantId,
        existingAsset.id,
        fingerprint,
        input.row,
        input.trx
      )
      await this.refreshScore(input.payload.tenantId, existingAsset, normalized, input.trx)
      return stagingRow
    }

    const asset = await PrecatorioAsset.create(
      {
        tenantId: input.payload.tenantId,
        sourceRecordId: input.sourceRecordId,
        source: 'siop',
        externalId,
        cnjNumber: normalized.cnjNumber,
        originProcessNumber: normalized.cnjNumber,
        debtorId: debtor.id,
        assetNumber: extractString(input.row, [
          'chave',
          'asset_number',
          'numero_precatorio',
          'precatorio',
        ]),
        exerciseYear: normalized.exerciseYear ?? input.payload.exerciseYear,
        budgetYear: normalized.exerciseYear ?? input.payload.exerciseYear,
        nature: detectAssetNature(input.row),
        faceValue: normalized.faceValue,
        estimatedUpdatedValue: normalized.updatedValue ?? normalized.faceValue,
        lifecycleStatus: 'discovered',
        piiStatus: 'none',
        complianceStatus: 'approved_for_analysis',
        rawData: input.row,
        rowFingerprint: fingerprint,
      },
      { client: input.trx }
    )

    input.stats.inserted += 1
    await this.createImportEvent(
      input.payload.tenantId,
      asset.id,
      fingerprint,
      input.row,
      input.trx
    )
    await this.refreshScore(input.payload.tenantId, asset, normalized, input.trx)

    return stagingRow
  }

  private validateNormalizedRow(normalized: ReturnType<typeof siopNormalizeService.normalizeRow>) {
    const errors: string[] = []

    if (!normalized.debtorName) errors.push('debtor_missing')
    if (!normalized.faceValue) errors.push('face_value_invalid')

    return errors
  }

  private async findOrCreateSourceRecord(payload: SiopImportRowsPayload, checksum: string) {
    const existing = await SourceRecord.query()
      .where('tenant_id', payload.tenantId)
      .where('source', 'siop')
      .where('source_checksum', checksum)
      .first()

    if (existing) {
      existing.merge({
        sourceUrl: payload.source?.url ?? existing.sourceUrl,
        sourceFilePath: payload.source?.filePath ?? existing.sourceFilePath,
        originalFilename: payload.source?.originalFilename ?? existing.originalFilename,
        mimeType: payload.source?.mimeType ?? existing.mimeType,
        fileSizeBytes: payload.source?.fileSizeBytes ?? existing.fileSizeBytes,
        rawData: payload.source?.metadata ?? existing.rawData,
      })
      await existing.save()
      return existing
    }

    return SourceRecord.create({
      tenantId: payload.tenantId,
      source: 'siop',
      sourceUrl: payload.source?.url ?? null,
      sourceFilePath: payload.source?.filePath ?? null,
      sourceChecksum: checksum,
      originalFilename: payload.source?.originalFilename ?? null,
      mimeType: payload.source?.mimeType ?? null,
      fileSizeBytes: payload.source?.fileSizeBytes ?? null,
      collectedAt: DateTime.now(),
      rawData: payload.source?.metadata ?? null,
    })
  }

  private async findOrCreateImport(
    payload: Pick<SiopImportRowsPayload, 'tenantId' | 'exerciseYear' | 'uploadedByUserId'> & {
      source?: SiopImportRowsPayload['source']
    },
    sourceRecordId: string
  ) {
    const existing = await this.findExistingImport(
      payload.tenantId,
      payload.exerciseYear,
      sourceRecordId
    )

    if (existing) {
      return existing
    }

    return this.createImport(payload, sourceRecordId)
  }

  private findExistingImport(tenantId: string, exerciseYear: number, sourceRecordId: string) {
    return SiopImport.query()
      .where('tenant_id', tenantId)
      .where('source', 'siop')
      .where('exercise_year', exerciseYear)
      .where('source_record_id', sourceRecordId)
      .first()
  }

  private createImport(
    payload: Pick<SiopImportRowsPayload, 'tenantId' | 'exerciseYear' | 'uploadedByUserId'> & {
      source?: SiopImportRowsPayload['source']
    },
    sourceRecordId: string
  ) {
    return SiopImport.create({
      tenantId: payload.tenantId,
      exerciseYear: payload.exerciseYear,
      sourceRecordId,
      source: 'siop',
      status: 'pending',
      totalRows: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      rawMetadata: payload.source?.metadata ?? null,
      uploadedByUserId: payload.uploadedByUserId ?? null,
    })
  }

  private async tryStartImport(siopImport: SiopImport) {
    return db.transaction(async (trx) => {
      const lock = await trx.rawQuery(
        `select pg_try_advisory_xact_lock(hashtextextended(?, 0)) as locked`,
        [`siop_import:${siopImport.id}`]
      )
      const locked = Boolean(lock.rows?.[0]?.locked)
      if (!locked) {
        return false
      }

      const currentImport = await SiopImport.query({ client: trx })
        .where('id', siopImport.id)
        .forUpdate()
        .firstOrFail()

      if (currentImport.status === 'running') {
        return false
      }

      currentImport.merge({
        status: 'running' as ImportStatus,
        startedAt: DateTime.now(),
        finishedAt: null,
        totalRows: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
      })
      currentImport.useTransaction(trx)
      await currentImport.save()

      siopImport.merge({
        status: currentImport.status,
        startedAt: currentImport.startedAt,
        finishedAt: currentImport.finishedAt,
        totalRows: currentImport.totalRows,
        inserted: currentImport.inserted,
        updated: currentImport.updated,
        skipped: currentImport.skipped,
        errors: currentImport.errors,
      })
      await SiopStagingRow.query({ client: trx }).where('import_id', siopImport.id).delete()

      return true
    })
  }

  private async findOrCreateDebtor(
    tenantId: string,
    row: JsonRecord,
    normalizedName: string,
    trx: TransactionClientContract
  ) {
    const existing = await Debtor.query({ client: trx })
      .where('tenant_id', tenantId)
      .where('normalized_key', normalizedName)
      .first()

    if (existing) {
      return existing
    }

    return Debtor.create(
      {
        tenantId,
        name:
          extractString(row, ['nome_da_uo_executada', 'devedor', 'debtor', 'debtor_name']) ??
          normalizedName,
        normalizedName,
        normalizedKey: normalizedName,
        debtorType: detectDebtorType(normalizedName),
        cnpj: onlyDigits(extractString(row, ['cnpj', 'document'])) || null,
        stateCode: extractStateCode(row) ?? 'BR',
        paymentRegime: 'federal_unique',
      },
      { client: trx }
    )
  }

  private findExistingAsset(
    tenantId: string,
    cnjNumber: string | null,
    externalId: string,
    trx: TransactionClientContract
  ) {
    const query = PrecatorioAsset.query({ client: trx }).where('tenant_id', tenantId)

    if (cnjNumber) {
      query.where((builder) => {
        builder.where('cnj_number', cnjNumber).orWhere('external_id', externalId)
      })
    } else {
      query.where('external_id', externalId)
    }

    return query.first()
  }

  private async createImportEvent(
    tenantId: string,
    assetId: string,
    fingerprint: string,
    row: JsonRecord,
    trx: TransactionClientContract
  ) {
    const idempotencyKey = `siop:${fingerprint}`
    const existing = await AssetEvent.query({ client: trx })
      .where('tenant_id', tenantId)
      .where('asset_id', assetId)
      .where('event_type', 'siop_imported')
      .where('idempotency_key', idempotencyKey)
      .first()

    if (existing) {
      return existing
    }

    return AssetEvent.create(
      {
        tenantId,
        assetId,
        eventType: 'siop_imported',
        eventDate: DateTime.now(),
        source: 'siop',
        payload: row,
        idempotencyKey,
      },
      { client: trx }
    )
  }

  private async refreshScore(
    tenantId: string,
    asset: PrecatorioAsset,
    normalized: ReturnType<typeof siopNormalizeService.normalizeRow>,
    trx: TransactionClientContract
  ) {
    const dataQualityScore =
      [normalized.cnjNumber, normalized.debtorName, normalized.faceValue].filter(Boolean).length *
      30
    const finalScore = Math.min(100, dataQualityScore + 10)
    const score = await AssetScore.create(
      {
        tenantId,
        assetId: asset.id,
        scoreVersion: 'siop-v1',
        dataQualityScore,
        maturityScore: normalized.exerciseYear
          ? Math.min(100, normalized.exerciseYear - 2000)
          : null,
        liquidityScore: null,
        legalSignalScore: null,
        economicScore: null,
        riskScore: null,
        finalScore,
        explanation: {
          source: 'siop',
          hasCnj: Boolean(normalized.cnjNumber),
          hasDebtor: Boolean(normalized.debtorName),
          hasFaceValue: Boolean(normalized.faceValue),
        },
      },
      { client: trx }
    )

    asset.currentScore = finalScore
    asset.currentScoreId = score.id
    asset.useTransaction(trx)
    await asset.save()

    return score
  }
}

export default new SiopImportService()

function detectDebtorType(normalizedName: string): DebtorType {
  if (normalizedName.includes('FUNDACAO')) return 'foundation'
  if (normalizedName.includes('INSTITUTO') || normalizedName.includes('AUTARQUIA'))
    return 'autarchy'
  return 'union'
}

function detectAssetNature(row: JsonRecord): AssetNature {
  const rawNature = String(
    row.nature ?? row.natureza ?? row.tributario ?? row.tipo_de_causa ?? ''
  ).toLowerCase()

  if (rawNature.includes('aliment')) return 'alimentar'
  if (rawNature.includes('tribut')) return 'tributario'
  if (rawNature.includes('comum')) return 'comum'

  return 'unknown'
}

function extractString(row: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim()
    }
  }

  return null
}

function extractStateCode(row: JsonRecord) {
  const value = extractString(row, ['state_code', 'uf', 'estado'])
  if (!value) return null

  const normalized = value.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null
}

function onlyDigits(value: string | null) {
  return value?.replace(/\D/g, '') ?? ''
}

function checksumRows(rows: JsonRecord[]) {
  return createHash('sha256').update(stableStringify(rows)).digest('hex')
}

function rowFingerprint(row: JsonRecord) {
  return createHash('sha256').update(stableStringify(row)).digest('hex')
}

function chunkRows<T>(rows: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size))
  }

  return chunks
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

async function persistSourceFile(input: {
  tenantId: string
  checksum: string
  originalFilename: string
  buffer: Buffer
}) {
  const directory = app.makePath('storage', 'siop', input.tenantId)
  const filename = `${input.checksum}-${safeFilename(input.originalFilename)}`
  const filePath = app.makePath('storage', 'siop', input.tenantId, filename)

  await mkdir(directory, { recursive: true })
  await writeFile(filePath, input.buffer)

  return filePath
}

async function parseSiopRows(buffer: Buffer, filename: string): Promise<JsonRecord[]> {
  if (isCsv(filename)) {
    return parseCsv(buffer.toString('utf8'))
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0])
  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    return []
  }

  const headers = getWorksheetHeaders(worksheet)
  const rows: JsonRecord[] = []

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const worksheetRow = worksheet.getRow(rowNumber)
    const row = headers.reduce<JsonRecord>((payload, header, index) => {
      payload[header] = normalizeCellValue(worksheetRow.getCell(index + 1).value)
      return payload
    }, {})

    if (Object.values(row).some((value) => value !== null && value !== '')) {
      rows.push(row)
    }
  }

  return rows
}

function getWorksheetHeaders(worksheet: ExcelJS.Worksheet) {
  const headerRow = worksheet.getRow(1)
  const headers: string[] = []

  for (let index = 1; index <= headerRow.cellCount; index += 1) {
    headers.push(normalizeHeader(String(headerRow.getCell(index).value ?? `column_${index}`)))
  }

  return headers
}

function parseCsv(contents: string): JsonRecord[] {
  const lines = contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return []
  }

  const delimiter = lines[0].includes(';') ? ';' : ','
  const headers = splitDelimitedLine(lines[0], delimiter).map(normalizeHeader)

  return lines.slice(1).map((line) => {
    const values = splitDelimitedLine(line, delimiter)
    return headers.reduce<JsonRecord>((row, header, index) => {
      row[header] = values[index] ?? null
      return row
    }, {})
  })
}

function splitDelimitedLine(line: string, delimiter: string) {
  const values: string[] = []
  let current = ''
  let quoted = false

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted
      continue
    }

    if (char === delimiter && !quoted) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  values.push(current.trim())
  return values
}

function normalizeCellValue(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value !== 'object') return value
  if ('text' in value) return value.text
  if ('result' in value) return value.result
  if ('richText' in value) return value.richText.map((entry) => entry.text).join('')

  return String(value)
}

function normalizeHeader(header: string) {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function detectParser(filename: string) {
  return isCsv(filename) ? 'csv' : 'xlsx'
}

function isCsv(filename: string) {
  return filename.toLowerCase().endsWith('.csv')
}

function safeFilename(filename: string) {
  return basename(filename).replace(/[^a-zA-Z0-9._-]+/g, '_')
}
