import { DateTime } from 'luxon'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import {
  TRIBUNAL_SOURCE_SYNC_QUEUE,
  handleTribunalSourceSync,
  type TribunalSourceSyncPayload,
} from '#modules/integrations/jobs/tribunal_source_sync_handler'
import type { Trf1PrecatorioLinkKind } from '#modules/integrations/services/trf1_precatorio_adapter'
import type { Trf3PrecatorioFileFormat } from '#modules/integrations/services/trf3_precatorio_adapter'
import type { Trf5PrecatorioLinkKind } from '#modules/integrations/services/trf5_precatorio_adapter'
import queueService from '#shared/services/queue_service'

export default class TribunalSyncSources extends BaseCommand {
  static commandName = 'tribunal:sync-sources'
  static description = 'Sync configured tribunal/government source targets into canonical records'
  static options = {
    startApp: true,
  }

  @flags.string({
    description: 'Tenant id that will own synchronized records',
  })
  declare tenantId?: string

  @flags.string({
    description: 'Comma-separated government_source_targets.key values',
  })
  declare targets?: string

  @flags.string({
    description: 'Comma-separated source_datasets.key values',
  })
  declare datasets?: string

  @flags.string({
    description: 'Comma-separated court aliases',
  })
  declare courts?: string

  @flags.string({
    description: 'Comma-separated adapter keys',
  })
  declare adapters?: string

  @flags.number({
    description: 'Maximum targets to inspect',
  })
  declare limit?: number

  @flags.number({
    description: 'Maximum DataJud pages per court target',
  })
  declare datajudMaxPagesPerCourt?: number

  @flags.number({
    description: 'Maximum DJEN pages per court target',
  })
  declare djenMaxPagesPerCourt?: number

  @flags.number({
    description: 'Maximum TJSP communication pages to process',
  })
  declare tjspLimit?: number

  @flags.number({
    description: 'Maximum linked documents to download from generic tribunal public sources',
  })
  declare genericTribunalLimit?: number

  @flags.boolean({
    description: 'Skip linked document downloads for generic tribunal public sources',
  })
  declare genericTribunalLandingOnly: boolean

  @flags.string({
    description: 'Comma-separated TRF2 years',
  })
  declare trf2Years?: string

  @flags.string({
    description: 'Comma-separated TRF1 years',
  })
  declare trf1Years?: string

  @flags.string({
    description:
      'Comma-separated TRF1 source kinds: federal_budget_proposal,federal_debt_map,subnational_budget_proposal,subnational_repasses,subnational_consolidated_debt,subnational_debt_map',
  })
  declare trf1Kinds?: string

  @flags.number({
    description: 'Maximum TRF1 files to download',
  })
  declare trf1Limit?: number

  @flags.number({
    description: 'Maximum TRF1 rows to import per downloaded file',
  })
  declare trf1ImportLimit?: number

  @flags.number({
    description: 'TRF1 rows processed per import batch',
  })
  declare trf1ImportChunkSize?: number

  @flags.string({
    description: 'Comma-separated TRF3 years',
  })
  declare trf3Years?: string

  @flags.string({
    description: 'Comma-separated TRF3 month numbers',
  })
  declare trf3Months?: string

  @flags.string({
    description: 'Comma-separated TRF3 file formats: csv,pdf,xlsx',
  })
  declare trf3Formats?: string

  @flags.number({
    description: 'Maximum TRF3 files to download',
  })
  declare trf3Limit?: number

  @flags.number({
    description: 'Maximum TRF3 rows to import per downloaded CSV/XLSX file',
  })
  declare trf3ImportLimit?: number

  @flags.number({
    description: 'TRF3 rows processed per import batch',
  })
  declare trf3ImportChunkSize?: number

  @flags.number({
    description: 'Maximum grouped TRF4 precatorios to import per downloaded queue file',
  })
  declare trf4ImportLimit?: number

  @flags.number({
    description: 'TRF4 grouped precatorios processed per import batch',
  })
  declare trf4ImportChunkSize?: number

  @flags.string({
    description: 'Comma-separated TRF5 years',
  })
  declare trf5Years?: string

  @flags.string({
    description:
      'Comma-separated TRF5 source kinds: paid_precatorios,federal_debt,state_municipal_chronological_order,state_municipal_special_regime_ec94,state_municipal_special_regime_ec136',
  })
  declare trf5Kinds?: string

  @flags.number({
    description: 'Maximum TRF5 PDFs to download',
  })
  declare trf5Limit?: number

  @flags.number({
    description: 'Maximum TRF5 rows to import per downloaded PDF',
  })
  declare trf5ImportLimit?: number

  @flags.number({
    description: 'TRF5 parsed rows processed per import batch',
  })
  declare trf5ImportChunkSize?: number

  @flags.string({
    description: 'Comma-separated TRF6 years',
  })
  declare trf6Years?: string

  @flags.number({
    description: 'Maximum TRF6 files to download',
  })
  declare trf6Limit?: number

  @flags.number({
    description: 'Maximum TRF6 rows to import per downloaded file',
  })
  declare trf6ImportLimit?: number

  @flags.number({
    description: 'TRF6 parsed rows processed per import batch',
  })
  declare trf6ImportChunkSize?: number

  @flags.boolean({
    description: 'Preview selected targets without downloading or mutating data',
  })
  declare dryRun: boolean

  @flags.boolean({
    description: 'Run inline instead of enqueueing a BullMQ job',
  })
  declare runInline: boolean

  async run() {
    if (!this.tenantId) {
      this.logger.error('--tenant-id is required.')
      this.exitCode = 1
      return
    }

    const payload: TribunalSourceSyncPayload = {
      tenantId: this.tenantId,
      targetKeys: splitList(this.targets),
      sourceDatasetKeys: splitList(this.datasets),
      courtAliases: splitList(this.courts),
      adapterKeys: splitList(this.adapters),
      limit: this.limit,
      dataJudMaxPagesPerCourt: this.datajudMaxPagesPerCourt,
      djenMaxPagesPerCourt: this.djenMaxPagesPerCourt,
      tjspLimit: this.tjspLimit,
      genericTribunalLimit: this.genericTribunalLimit,
      genericTribunalDownloadLinkedDocuments: !this.genericTribunalLandingOnly,
      trf1Years: parseYears(this.trf1Years),
      trf1Kinds: parseTrf1Kinds(this.trf1Kinds),
      trf1Limit: this.trf1Limit,
      trf1ImportLimit: this.trf1ImportLimit,
      trf1ImportChunkSize: this.trf1ImportChunkSize,
      trf2Years: parseYears(this.trf2Years),
      trf3Years: parseYears(this.trf3Years),
      trf3Months: parsePositiveIntegers(this.trf3Months),
      trf3Formats: parseTrf3Formats(this.trf3Formats),
      trf3Limit: this.trf3Limit,
      trf3ImportLimit: this.trf3ImportLimit,
      trf3ImportChunkSize: this.trf3ImportChunkSize,
      trf4ImportLimit: this.trf4ImportLimit,
      trf4ImportChunkSize: this.trf4ImportChunkSize,
      trf5Years: parseYears(this.trf5Years),
      trf5Kinds: parseTrf5Kinds(this.trf5Kinds),
      trf5Limit: this.trf5Limit,
      trf5ImportLimit: this.trf5ImportLimit,
      trf5ImportChunkSize: this.trf5ImportChunkSize,
      trf6Years: parseYears(this.trf6Years),
      trf6Limit: this.trf6Limit,
      trf6ImportLimit: this.trf6ImportLimit,
      trf6ImportChunkSize: this.trf6ImportChunkSize,
      dryRun: this.dryRun,
      origin: 'manual_retry',
    }

    if (this.runInline) {
      const result = await handleTribunalSourceSync(payload)
      this.logger.info(`Tribunal source sync completed inline: ${JSON.stringify(result)}`)
      return
    }

    const job = await queueService.add(
      TRIBUNAL_SOURCE_SYNC_QUEUE,
      'tribunal-source-sync',
      payload,
      {
        jobId: `tribunal-source-sync-${this.tenantId}-${DateTime.utc().toMillis()}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    )

    this.logger.info(
      `Tribunal source sync enqueued: ${JSON.stringify({
        tenantId: this.tenantId,
        jobId: job.id,
      })}`
    )

    await queueService.shutdown()
  }
}

function splitList(value?: string) {
  if (!value?.trim()) {
    return undefined
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseYears(value?: string) {
  return splitList(value)
    ?.map((year) => Number(year))
    .filter((year) => Number.isInteger(year))
}

function parsePositiveIntegers(value?: string) {
  return splitList(value)
    ?.map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0)
}

function parseTrf3Formats(value?: string) {
  const allowed = new Set<Trf3PrecatorioFileFormat>(['csv', 'pdf', 'xlsx'])

  return splitList(value)?.filter((format): format is Trf3PrecatorioFileFormat =>
    allowed.has(format as Trf3PrecatorioFileFormat)
  )
}

function parseTrf1Kinds(value?: string) {
  const allowed = new Set<Trf1PrecatorioLinkKind>([
    'federal_budget_proposal',
    'federal_debt_map',
    'subnational_budget_proposal',
    'subnational_repasses',
    'subnational_consolidated_debt',
    'subnational_debt_map',
  ])

  return splitList(value)?.filter((kind): kind is Trf1PrecatorioLinkKind =>
    allowed.has(kind as Trf1PrecatorioLinkKind)
  )
}

function parseTrf5Kinds(value?: string) {
  const allowed = new Set<Trf5PrecatorioLinkKind>([
    'paid_precatorios',
    'federal_debt',
    'state_municipal_chronological_order',
    'state_municipal_special_regime_ec94',
    'state_municipal_special_regime_ec136',
  ])

  return splitList(value)?.filter((kind): kind is Trf5PrecatorioLinkKind =>
    allowed.has(kind as Trf5PrecatorioLinkKind)
  )
}
