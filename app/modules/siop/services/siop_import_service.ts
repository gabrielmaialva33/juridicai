import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { createInterface } from 'node:readline'
import { DateTime } from 'luxon'
import ExcelJS from 'exceljs'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import siopImportRepository from '#modules/siop/repositories/siop_import_repository'
import siopNormalizeService from '#modules/siop/services/siop_normalize_service'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetScore from '#modules/precatorios/models/asset_score'
import AssetBudgetFact from '#modules/precatorios/models/asset_budget_fact'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import Debtor from '#modules/debtors/models/debtor'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import BudgetUnit from '#modules/reference/models/budget_unit'
import Court from '#modules/reference/models/court'
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

    await this.persistImportProgress(siopImport, stats)

    await this.processRowChunks({
      chunks: chunkRows(payload.rows, IMPORT_CHUNK_SIZE),
      payload,
      siopImport,
      sourceRecordId: sourceRecord.id,
      stats,
    })
    await this.finishImport(siopImport, stats, {
      ...(payload.source?.metadata ?? {}),
      checksum,
    })

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

    const filename = siopImport.sourceRecord.originalFilename ?? `siop-${siopImport.id}.xlsx`

    if (isCsv(filename)) {
      return this.processCsvImportFile(siopImport)
    }

    const buffer = await readFile(siopImport.sourceRecord.sourceFilePath)
    const checksum =
      siopImport.sourceRecord.sourceChecksum ?? createHash('sha256').update(buffer).digest('hex')
    const rows = await parseSiopRows(buffer, filename)
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

  private async processCsvImportFile(siopImport: SiopImport): Promise<SiopImportResult> {
    const sourceFilePath = siopImport.sourceRecord.sourceFilePath!
    const checksum = siopImport.sourceRecord.sourceChecksum ?? (await checksumFile(sourceFilePath))
    const payload: SiopImportRowsPayload = {
      tenantId: siopImport.tenantId,
      exerciseYear: siopImport.exerciseYear,
      uploadedByUserId: siopImport.uploadedByUserId,
      rows: [],
      source: {
        checksum,
        originalFilename: siopImport.sourceRecord.originalFilename,
        mimeType: siopImport.sourceRecord.mimeType,
        fileSizeBytes: siopImport.sourceRecord.fileSizeBytes,
        filePath: sourceFilePath,
        metadata: {
          ...(siopImport.sourceRecord.rawData ?? {}),
          parser: 'csv',
        },
      },
    }
    const stats: ImportStats = {
      totalRows: await countCsvDataRows(sourceFilePath),
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
          skipped: stats.totalRows,
        },
        skipped: true,
        reason: 'already_running',
      }
    }

    await this.persistImportProgress(siopImport, stats)
    await this.processRowChunks({
      chunks: streamCsvRowChunks(sourceFilePath, IMPORT_CHUNK_SIZE),
      payload,
      siopImport,
      sourceRecordId: siopImport.sourceRecordId,
      stats,
    })
    await this.finishImport(siopImport, stats, {
      ...(payload.source?.metadata ?? {}),
      checksum,
    })

    return { import: siopImport, stats }
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
    const court = await this.findOrCreateCourt(normalized, input.trx)
    const budgetUnit = await this.findOrCreateBudgetUnit(normalized, input.trx)

    if (existingAsset) {
      existingAsset.useTransaction(input.trx)
      existingAsset.merge({
        sourceRecordId: input.sourceRecordId,
        debtorId: debtor.id,
        courtId: court?.id ?? null,
        budgetUnitId: budgetUnit?.id ?? null,
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
        originFiledAt: normalized.originFiledAt,
        autuatedAt: normalized.autuatedAt,
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
      await this.createBudgetFact(
        input.payload.tenantId,
        existingAsset.id,
        budgetUnit?.id ?? null,
        input.sourceRecordId,
        normalized,
        input.row,
        input.trx
      )
      await this.createValuation(
        input.payload.tenantId,
        existingAsset.id,
        input.sourceRecordId,
        normalized,
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
        courtId: court?.id ?? null,
        budgetUnitId: budgetUnit?.id ?? null,
        assetNumber: extractString(input.row, [
          'chave',
          'asset_number',
          'numero_precatorio',
          'precatorio',
        ]),
        exerciseYear: normalized.exerciseYear ?? input.payload.exerciseYear,
        budgetYear: normalized.exerciseYear ?? input.payload.exerciseYear,
        nature: detectAssetNature(input.row),
        originFiledAt: normalized.originFiledAt,
        autuatedAt: normalized.autuatedAt,
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
    await this.createBudgetFact(
      input.payload.tenantId,
      asset.id,
      budgetUnit?.id ?? null,
      input.sourceRecordId,
      normalized,
      input.row,
      input.trx
    )
    await this.createValuation(
      input.payload.tenantId,
      asset.id,
      input.sourceRecordId,
      normalized,
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

  private async persistImportProgress(siopImport: SiopImport, stats: ImportStats) {
    siopImport.merge({
      totalRows: stats.totalRows,
      inserted: stats.inserted,
      updated: stats.updated,
      skipped: stats.skipped,
      errors: stats.errors,
    })
    await siopImport.save()
  }

  private async processRowChunks(input: {
    chunks: Iterable<JsonRecord[]> | AsyncIterable<JsonRecord[]>
    payload: SiopImportRowsPayload
    siopImport: SiopImport
    sourceRecordId: string
    stats: ImportStats
  }) {
    for await (const rows of input.chunks) {
      await db.transaction(async (trx) => {
        for (const row of rows) {
          await this.processRow({
            row,
            payload: input.payload,
            siopImport: input.siopImport,
            sourceRecordId: input.sourceRecordId,
            stats: input.stats,
            trx,
          })
        }
      })
      await this.persistImportProgress(input.siopImport, input.stats)
    }
  }

  private async finishImport(siopImport: SiopImport, stats: ImportStats, metadata: JsonRecord) {
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
      rawMetadata: metadata,
    })
    await siopImport.save()
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

  private async createBudgetFact(
    tenantId: string,
    assetId: string,
    budgetUnitId: string | null,
    sourceRecordId: string,
    normalized: ReturnType<typeof siopNormalizeService.normalizeRow>,
    row: JsonRecord,
    trx: TransactionClientContract
  ) {
    const query = AssetBudgetFact.query({ client: trx })
      .where('tenant_id', tenantId)
      .where('asset_id', assetId)
      .where('source_record_id', sourceRecordId)

    if (normalized.exerciseYear) {
      query.where('exercise_year', normalized.exerciseYear)
    } else {
      query.whereNull('exercise_year')
    }

    if (normalized.exerciseYear) {
      query.where('budget_year', normalized.exerciseYear)
    } else {
      query.whereNull('budget_year')
    }

    const existing = await query.first()
    const payload = {
      tenantId,
      assetId,
      exerciseYear: normalized.exerciseYear,
      budgetYear: normalized.exerciseYear,
      budgetUnitId,
      expenseType: normalized.expenseType,
      causeType: normalized.causeType,
      natureExpenseCode: normalized.natureExpenseCode,
      valueRange: normalized.valueRange,
      taxClaim: normalized.taxClaim,
      fundef: normalized.fundef,
      elapsedYears: normalized.elapsedYears,
      elapsedYearsClass: normalized.elapsedYearsClass,
      sourceRecordId,
      rawData: row,
    }

    if (existing) {
      existing.useTransaction(trx)
      existing.merge(payload)
      await existing.save()
      return existing
    }

    return AssetBudgetFact.create(payload, { client: trx })
  }

  private async createValuation(
    tenantId: string,
    assetId: string,
    sourceRecordId: string,
    normalized: ReturnType<typeof siopNormalizeService.normalizeRow>,
    row: JsonRecord,
    trx: TransactionClientContract
  ) {
    return AssetValuation.create(
      {
        tenantId,
        assetId,
        faceValue: normalized.faceValue,
        estimatedUpdatedValue: normalized.updatedValue ?? normalized.faceValue,
        baseDate: normalized.correctionEndedAt ?? normalized.autuatedAt ?? normalized.originFiledAt,
        correctionStartedAt: normalized.correctionStartedAt,
        correctionEndedAt: normalized.correctionEndedAt,
        correctionIndex: normalized.correctionIndex,
        sourceRecordId,
        rawData: row,
      },
      { client: trx }
    )
  }

  private async findOrCreateCourt(
    normalized: ReturnType<typeof siopNormalizeService.normalizeRow>,
    trx: TransactionClientContract
  ) {
    if (!normalized.courtCode || !normalized.courtName) {
      return null
    }

    const existing = await Court.query({ client: trx }).where('code', normalized.courtCode).first()
    if (existing) {
      existing.merge({
        name: normalized.courtName,
        courtClass: normalized.courtClass,
      })
      await existing.save()
      return existing
    }

    return Court.create(
      {
        code: normalized.courtCode,
        alias: null,
        name: normalized.courtName,
        courtClass: normalized.courtClass,
      },
      { client: trx }
    )
  }

  private async findOrCreateBudgetUnit(
    normalized: ReturnType<typeof siopNormalizeService.normalizeRow>,
    trx: TransactionClientContract
  ) {
    if (!normalized.budgetUnitCode || !normalized.budgetUnitName) {
      return null
    }

    const existing = await BudgetUnit.query({ client: trx })
      .where('code', normalized.budgetUnitCode)
      .first()
    if (existing) {
      existing.name = normalized.budgetUnitName
      await existing.save()
      return existing
    }

    return BudgetUnit.create(
      {
        code: normalized.budgetUnitCode,
        name: normalized.budgetUnitName,
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

async function countCsvDataRows(filePath: string) {
  let totalRows = 0
  let hasHeader = false

  for await (const rawLine of readLines(filePath)) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }

    if (!hasHeader) {
      hasHeader = true
      continue
    }

    totalRows += 1
  }

  return totalRows
}

async function* streamCsvRowChunks(filePath: string, chunkSize: number) {
  let headers: string[] | null = null
  let delimiter = ','
  let rows: JsonRecord[] = []

  for await (const rawLine of readLines(filePath)) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }

    if (!headers) {
      delimiter = detectDelimiter(line)
      headers = splitDelimitedLine(line, delimiter).map(normalizeHeader)
      continue
    }

    const values = splitDelimitedLine(line, delimiter)
    const row = headers.reduce<JsonRecord>((payload, header, index) => {
      payload[header] = values[index] ?? null
      return payload
    }, {})

    if (!Object.values(row).some((value) => value !== null && value !== '')) {
      continue
    }

    rows.push(row)

    if (rows.length >= chunkSize) {
      yield rows
      rows = []
    }
  }

  if (rows.length > 0) {
    yield rows
  }
}

async function* readLines(filePath: string) {
  const reader = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })

  try {
    for await (const line of reader) {
      yield line
    }
  } finally {
    reader.close()
  }
}

async function checksumFile(filePath: string) {
  const hash = createHash('sha256')

  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk)
  }

  return hash.digest('hex')
}

function detectDelimiter(line: string) {
  return line.includes(';') ? ';' : ','
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
