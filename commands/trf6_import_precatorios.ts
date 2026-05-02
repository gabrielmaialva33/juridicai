import { readFile } from 'node:fs/promises'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import trf6PrecatorioImportService from '#modules/integrations/services/trf6_precatorio_import_service'
import trf6ManualExportService from '#modules/integrations/services/trf6_manual_export_service'

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
    const persisted = await trf6ManualExportService.persistExport({
      tenantId,
      exerciseYear: this.year ?? new Date().getFullYear(),
      buffer,
      originalFilename: filePath,
      mimeType: mimeTypeFromFilename(filePath),
      fileSizeBytes: buffer.byteLength,
    })

    return persisted.sourceRecord
  }
}

function mimeTypeFromFilename(filename: string) {
  return filename.toLowerCase().endsWith('.csv') ? 'text/csv' : 'application/pdf'
}
