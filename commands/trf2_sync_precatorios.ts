import { BaseCommand, flags } from '@adonisjs/core/ace'
import trf2PrecatorioAdapter from '#modules/integrations/services/trf2_precatorio_adapter'

export default class Trf2SyncPrecatorios extends BaseCommand {
  static commandName = 'trf2:sync-precatorios'
  static description = 'Discover and sync TRF2 public precatorio CSV source files'
  static options = {
    startApp: true,
  }

  @flags.string({
    description: 'Tenant id that will own the source records',
  })
  declare tenantId?: string

  @flags.string({
    description: 'Comma-separated years or ranges, for example "2024,2025"',
  })
  declare years?: string

  @flags.boolean({
    description: 'Only discover links without downloading files',
  })
  declare dryRun: boolean

  async run() {
    if (!this.tenantId && !this.dryRun) {
      this.logger.error('--tenant-id is required unless --dry-run is enabled.')
      this.exitCode = 1
      return
    }

    if (this.dryRun) {
      const links = await trf2PrecatorioAdapter.discover()
      const selectedYears = parseYears(this.years)
      const selected = selectedYears
        ? links.filter((link) => selectedYears.includes(link.year ?? 0))
        : links

      for (const link of selected) {
        this.logger.info(`TRF2 precatorio link: ${JSON.stringify(link)}`)
      }
      return
    }

    const result = await trf2PrecatorioAdapter.sync({
      tenantId: this.tenantId!,
      years: parseYears(this.years),
    })

    this.logger.info(
      `TRF2 precatorio sync completed: ${JSON.stringify({
        discovered: result.discovered,
        selected: result.selected,
        downloaded: result.downloaded,
        items: result.items.map((item) => ({
          kind: item.link.kind,
          year: item.link.year,
          sourceRecordId: item.sourceRecord?.id ?? null,
          sourceRecordCreated: item.sourceRecordCreated ?? null,
          parsedRows: item.parsedRows ?? null,
          validCnjRows: item.validCnjRows ?? null,
          uniqueCnjNumbers: item.uniqueCnjNumbers ?? null,
        })),
      })}`
    )
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
