import { BaseCommand, flags } from '@adonisjs/core/ace'
import dataJudPublicApiAdapter from '#modules/integrations/services/datajud_public_api_adapter'
import {
  inferDataJudCourtAliases,
  normalizeAliases,
} from '#modules/integrations/services/datajud_asset_enrichment_service'
import { normalizeCnj } from '#modules/siop/parsers/cnj_parser'

export default class DataJudSyncProcess extends BaseCommand {
  static commandName = 'datajud:sync-process'
  static description = 'Query CNJ DataJud public API and sync process metadata by CNJ number'
  static options = {
    startApp: true,
  }

  @flags.string({
    description: 'Tenant id that will own persisted DataJud source records',
  })
  declare tenantId?: string

  @flags.string({
    description: 'Formatted or digit-only CNJ process number',
  })
  declare cnj?: string

  @flags.string({
    description:
      'Comma-separated DataJud court aliases. When omitted, inferred from the CNJ number',
  })
  declare courts?: string

  @flags.boolean({
    description: 'Query DataJud without persisting source records or judicial processes',
  })
  declare dryRun: boolean

  async run() {
    const cnjNumber = normalizeCnj(this.cnj)

    if (!cnjNumber) {
      this.logger.error('--cnj must be a valid CNJ process number.')
      this.exitCode = 1
      return
    }

    const courtAliases = parseCourtAliases(this.courts) ?? inferDataJudCourtAliases(cnjNumber)

    if (courtAliases.length === 0) {
      this.logger.error(
        '--courts is required when the court cannot be inferred from the CNJ number.'
      )
      this.exitCode = 1
      return
    }

    if (this.dryRun) {
      await this.queryOnly(cnjNumber, courtAliases)
      return
    }

    if (!this.tenantId) {
      this.logger.error('--tenant-id is required unless --dry-run is enabled.')
      this.exitCode = 1
      return
    }

    const result = await dataJudPublicApiAdapter.syncByCnj({
      tenantId: this.tenantId,
      cnjNumber,
      courtAliases,
    })

    this.logger.info(
      `DataJud sync completed: ${JSON.stringify({
        cnjNumber,
        requestedCourts: result.requestedCourts,
        synced: result.synced,
        courts: courtAliases,
      })}`
    )
  }

  private async queryOnly(cnjNumber: string, courtAliases: string[]) {
    for (const courtAlias of courtAliases) {
      const response = await dataJudPublicApiAdapter.searchByCnj({
        courtAlias,
        cnjNumber,
      })

      this.logger.info(
        `DataJud dry-run result: ${JSON.stringify({
          cnjNumber,
          courtAlias,
          total: response.hits.total,
          hits: response.hits.hits.map((hit) => ({
            id: hit._id,
            index: hit._index,
            tribunal: hit._source.tribunal ?? null,
            classe: hit._source.classe ?? null,
          })),
        })}`
      )
    }
  }
}

function parseCourtAliases(value?: string) {
  if (!value) {
    return null
  }

  return normalizeAliases(value.split(','))
}
