import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { DateTime } from 'luxon'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import app from '@adonisjs/core/services/app'
import { TRF6_EPROC_FEDERAL_PRECATORIO_EXPORT_URL } from '#modules/integrations/services/trf6_precatorio_adapter'
import trf6PrecatorioImportService from '#modules/integrations/services/trf6_precatorio_import_service'
import sourceEvidenceService from '#modules/integrations/services/source_evidence_service'
import SourceRecord from '#modules/siop/models/source_record'

export default class Trf6ImportPrecatorios extends BaseCommand {
  static commandName = 'trf6:import-precatorios'
  static description = 'Import a TRF6 precatorio source record or local eproc CSV export'
  static options = {
    startApp: true,
  }

  @flags.string({
    description: 'Tenant id that will own imported records',
  })
  declare tenantId?: string

  @flags.string({
    description: 'Existing source_records.id to import',
  })
  declare sourceRecordId?: string

  @flags.string({
    description: 'Local TRF6 CSV/PDF file path to persist and import',
  })
  declare file?: string

  @flags.number({
    description: 'Budget/proposal year for local files',
  })
  declare year?: number

  @flags.number({
    description: 'Maximum rows to import',
  })
  declare limit?: number

  @flags.number({
    description: 'Parsed rows processed per import batch',
  })
  declare chunkSize?: number

  async run() {
    const sourceRecordId = await this.resolveSourceRecordId()
    if (!sourceRecordId) {
      return
    }

    const result = await trf6PrecatorioImportService.importSourceRecord(sourceRecordId, {
      maxRows: this.limit,
      chunkSize: this.chunkSize,
    })

    this.logger.info(
      `TRF6 precatorio import completed: ${JSON.stringify({
        sourceRecordId: result.sourceRecord.id,
        extraction: {
          format: result.extraction.format,
          status: result.extraction.status,
          rows: result.extraction.rows.length,
          errors: result.extraction.errors,
        },
        stats: result.stats,
        chunking: result.chunking,
      })}`
    )
  }

  private async resolveSourceRecordId() {
    if (this.sourceRecordId) {
      return this.sourceRecordId
    }

    if (!this.tenantId || !this.file) {
      this.logger.error('Provide --source-record-id or both --tenant-id and --file.')
      this.exitCode = 1
      return null
    }

    const sourceRecord = await this.persistLocalFile(this.tenantId, this.file)
    return sourceRecord.id
  }

  private async persistLocalFile(tenantId: string, filePath: string) {
    const buffer = await readFile(filePath)
    const checksum = createHash('sha256').update(buffer).digest('hex')
    const filename = basename(filePath)
    const directory = app.makePath('storage', 'tribunal', 'trf6', tenantId)
    const storedPath = app.makePath('storage', 'tribunal', 'trf6', tenantId, filename)
    const sourceDatasetId = await sourceEvidenceService.datasetIdByKey(
      'trf6-federal-precatorio-orders'
    )
    const rawData = {
      providerId: 'trf6-federal-precatorio-orders',
      courtAlias: 'trf6',
      sourceKind: 'federal_budget_order',
      year: this.year ?? null,
      sourceUrl: TRF6_EPROC_FEDERAL_PRECATORIO_EXPORT_URL,
      format: formatFromFilename(filename),
      originalFilename: filename,
      manualExport: true,
    }
    const existing = await SourceRecord.query()
      .where('tenant_id', tenantId)
      .where('source', 'tribunal')
      .where('source_checksum', checksum)
      .first()

    await mkdir(directory, { recursive: true })
    await copyFile(filePath, storedPath)

    if (existing) {
      existing.merge({
        sourceDatasetId,
        sourceUrl: TRF6_EPROC_FEDERAL_PRECATORIO_EXPORT_URL,
        sourceFilePath: storedPath,
        originalFilename: filename,
        mimeType: mimeTypeFromFilename(filename),
        fileSizeBytes: buffer.byteLength,
        rawData,
      })
      await existing.save()
      return existing
    }

    return SourceRecord.create({
      tenantId,
      sourceDatasetId,
      source: 'tribunal',
      sourceUrl: TRF6_EPROC_FEDERAL_PRECATORIO_EXPORT_URL,
      sourceFilePath: storedPath,
      sourceChecksum: checksum,
      originalFilename: filename,
      mimeType: mimeTypeFromFilename(filename),
      fileSizeBytes: buffer.byteLength,
      collectedAt: DateTime.now(),
      rawData,
    })
  }
}

function formatFromFilename(filename: string) {
  return filename.toLowerCase().endsWith('.csv') ? 'csv' : 'pdf'
}

function mimeTypeFromFilename(filename: string) {
  return filename.toLowerCase().endsWith('.csv') ? 'text/csv' : 'application/pdf'
}
