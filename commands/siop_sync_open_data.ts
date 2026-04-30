import { BaseCommand, flags } from '@adonisjs/core/ace'
import queueService from '#shared/services/queue_service'
import siopOpenDataAdapter from '#modules/integrations/services/siop_open_data_adapter'
import {
  SIOP_IMPORT_QUEUE,
  type SiopImportJobPayload,
} from '#modules/siop/jobs/siop_import_handler'

export default class SiopSyncOpenData extends BaseCommand {
  static commandName = 'siop:sync-open-data'
  static description = 'Discover and sync SIOP federal open-data precatorio files'
  static options = {
    startApp: true,
  }

  @flags.string({
    description: 'Tenant id that will own the source records and pending imports',
  })
  declare tenantId?: string

  @flags.string({
    description: 'Comma-separated years or ranges, for example "2024,2025-2027"',
  })
  declare years?: string

  @flags.boolean({
    description: 'Only discover links without downloading files or creating imports',
  })
  declare dryRun: boolean

  @flags.boolean({
    description: 'Enqueue created or reused pending annual imports after syncing',
  })
  declare enqueue: boolean

  async run() {
    if (!this.tenantId && !this.dryRun) {
      this.logger.error('--tenant-id is required unless --dry-run is enabled.')
      this.exitCode = 1
      return
    }

    if (this.dryRun) {
      const links = await siopOpenDataAdapter.discover()
      const selectedYears = parseYears(this.years)
      const selected = selectedYears
        ? links.filter(
            (link) => link.kind !== 'expedition_file' || selectedYears.includes(link.year ?? 0)
          )
        : links

      for (const link of selected) {
        this.logger.info(`SIOP open-data link: ${JSON.stringify(link)}`)
      }
      return
    }

    const result = await siopOpenDataAdapter.sync({
      tenantId: this.tenantId!,
      years: parseYears(this.years),
    })

    if (this.enqueue) {
      await this.enqueueImports(result.items)
    }

    this.logger.info(
      `SIOP open-data sync completed: ${JSON.stringify({
        discovered: result.discovered,
        selected: result.selected,
        downloaded: result.downloaded,
        importsCreated: result.importsCreated,
        importsReused: result.importsReused,
        enqueue: this.enqueue,
      })}`
    )
  }

  private async enqueueImports(
    items: Awaited<ReturnType<typeof siopOpenDataAdapter.sync>>['items']
  ) {
    for (const item of items) {
      if (!item.siopImport) {
        continue
      }

      const payload: SiopImportJobPayload = {
        tenantId: item.siopImport.tenantId,
        importId: item.siopImport.id,
        origin: 'system',
      }
      const job = await queueService.add(SIOP_IMPORT_QUEUE, 'siop-import', payload, {
        jobId: `siop-open-data-${item.siopImport.tenantId}-${item.siopImport.id}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      })

      this.logger.info(
        `SIOP import enqueued: ${JSON.stringify({
          importId: item.siopImport.id,
          year: item.link.year,
          jobId: job.id,
        })}`
      )
    }
  }
}

function parseYears(value?: string) {
  if (!value) {
    return undefined
  }

  const years = value
    .split(',')
    .flatMap((part) => expandYearPart(part.trim()))
    .filter((year) => year >= 2000 && year <= 2100)

  return [...new Set(years)].sort((left, right) => left - right)
}

function expandYearPart(value: string) {
  if (!value) {
    return []
  }

  const range = value.match(/^(\d{4})-(\d{4})$/)
  if (!range) {
    return [Number(value)].filter(Number.isInteger)
  }

  const start = Number(range[1])
  const end = Number(range[2])
  const min = Math.min(start, end)
  const max = Math.max(start, end)
  const years: number[] = []

  for (let year = min; year <= max; year += 1) {
    years.push(year)
  }

  return years
}
