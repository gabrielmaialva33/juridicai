import { BaseCommand, flags } from '@adonisjs/core/ace'
import { handleSiopImport } from '#modules/siop/jobs/siop_import_handler'

export default class SiopProcessImport extends BaseCommand {
  static commandName = 'siop:process-import'
  static description = 'Process a pending SIOP import inline through the job handler'
  static options = {
    startApp: true,
  }

  @flags.string({
    description: 'Tenant id that owns the import',
  })
  declare tenantId?: string

  @flags.string({
    description: 'SIOP import id to process',
  })
  declare importId?: string

  async run() {
    if (!this.tenantId || !this.importId) {
      this.logger.error('--tenant-id and --import-id are required.')
      this.exitCode = 1
      return
    }

    const stats = await handleSiopImport({
      tenantId: this.tenantId,
      importId: this.importId,
      origin: 'manual_retry',
    })

    this.logger.info(`SIOP import processed inline: ${JSON.stringify(stats)}`)
  }
}
