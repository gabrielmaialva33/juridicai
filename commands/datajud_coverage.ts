import { BaseCommand, flags } from '@adonisjs/core/ace'
import dataJudCoverageService from '#modules/integrations/services/datajud_coverage_service'
import type { SourceType } from '#shared/types/model_enums'

export default class DataJudCoverage extends BaseCommand {
  static commandName = 'datajud:coverage'
  static description = 'Report DataJud enrichment coverage for tenant precatorio assets'
  static options = {
    startApp: true,
  }

  @flags.string({
    description: 'Tenant id to inspect',
  })
  declare tenantId?: string

  @flags.string({
    description: 'Optional asset source filter, for example "siop"',
  })
  declare source?: SourceType

  async run() {
    if (!this.tenantId) {
      this.logger.error('--tenant-id is required.')
      this.exitCode = 1
      return
    }

    const report = await dataJudCoverageService.report({
      tenantId: this.tenantId,
      source: this.source,
    })

    this.logger.info(`DataJud coverage: ${JSON.stringify(report)}`)
  }
}
