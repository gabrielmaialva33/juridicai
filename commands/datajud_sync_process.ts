import { BaseCommand, flags } from '@adonisjs/core/ace'
import dataJudPublicApiAdapter from '#modules/integrations/services/datajud_public_api_adapter'
import { normalizeCnj } from '#modules/siop/parsers/cnj_parser'

const STATE_COURT_ALIASES: Record<string, string> = {
  '01': 'tjac',
  '02': 'tjal',
  '03': 'tjam',
  '04': 'tjap',
  '05': 'tjba',
  '06': 'tjce',
  '07': 'tjdft',
  '08': 'tjes',
  '09': 'tjgo',
  '10': 'tjma',
  '13': 'tjmg',
  '12': 'tjms',
  '11': 'tjmt',
  '14': 'tjpa',
  '15': 'tjpb',
  '17': 'tjpe',
  '18': 'tjpi',
  '16': 'tjpr',
  '19': 'tjrj',
  '20': 'tjrn',
  '22': 'tjro',
  '23': 'tjrr',
  '21': 'tjrs',
  '24': 'tjsc',
  '25': 'tjse',
  '26': 'tjsp',
  '27': 'tjto',
}

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

    const courtAliases = parseCourtAliases(this.courts) ?? inferCourtAliases(cnjNumber)

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

  return value
    .split(',')
    .map((alias) => alias.trim().toLowerCase())
    .filter(Boolean)
}

function inferCourtAliases(cnjNumber: string) {
  const digits = cnjNumber.replace(/\D/g, '')
  const segment = digits.slice(13, 14)
  const court = digits.slice(14, 16)

  if (segment === '4') {
    return [`trf${Number(court)}`]
  }

  if (segment === '5') {
    return [`trt${Number(court)}`]
  }

  if (segment === '8') {
    return STATE_COURT_ALIASES[court] ? [STATE_COURT_ALIASES[court]] : []
  }

  return []
}
