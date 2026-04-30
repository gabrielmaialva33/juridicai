import { BaseCommand, args } from '@adonisjs/core/ace'
import trf2PrecatorioImportService from '#modules/integrations/services/trf2_precatorio_import_service'

export default class Trf2ImportPrecatorios extends BaseCommand {
  static commandName = 'trf2:import-precatorios'
  static description = 'Import a persisted TRF2 precatorio CSV source record into domain tables'
  static options = {
    startApp: true,
  }

  @args.string({
    description: 'TRF2 source_records.id to import',
  })
  declare sourceRecordId: string

  async run() {
    const result = await trf2PrecatorioImportService.importSourceRecord(this.sourceRecordId)

    this.logger.info(
      `TRF2 precatorio import completed: ${JSON.stringify({
        sourceRecordId: result.sourceRecord.id,
        stats: result.stats,
      })}`
    )
  }
}
