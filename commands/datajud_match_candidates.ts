import { BaseCommand, flags } from '@adonisjs/core/ace'
import { DateTime } from 'luxon'
import dataJudCandidateMatchService from '#modules/integrations/services/datajud_candidate_match_service'
import {
  DATAJUD_MATCH_CANDIDATES_QUEUE,
  handleDataJudMatchCandidates,
  type DataJudMatchCandidatesPayload,
} from '#modules/integrations/jobs/datajud_match_candidates_handler'
import queueService from '#shared/services/queue_service'
import type { SourceType } from '#shared/types/model_enums'

export default class DataJudMatchCandidates extends BaseCommand {
  static commandName = 'datajud:match-candidates'
  static description =
    'Find DataJud process candidates for precatorio assets without promoting links'
  static options = {
    startApp: true,
  }

  @flags.string({
    description: 'Tenant id that owns the assets to inspect',
  })
  declare tenantId?: string

  @flags.string({
    description: 'Optional asset source filter, for example "tribunal"',
  })
  declare source?: SourceType

  @flags.number({
    description: 'Maximum number of assets to inspect',
  })
  declare limit?: number

  @flags.number({
    description: 'Maximum DataJud candidates to fetch per asset',
  })
  declare candidatesPerAsset?: number

  @flags.boolean({
    description: 'Persist candidates into process_match_candidates',
  })
  declare persist: boolean

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

    const payload: DataJudMatchCandidatesPayload = {
      tenantId: this.tenantId,
      source: this.source,
      limit: this.limit,
      candidatesPerAsset: this.candidatesPerAsset,
      persist: this.persist,
      origin: 'manual_retry',
    }

    if (this.runInline || !this.persist) {
      const result = this.persist
        ? await handleDataJudMatchCandidates(payload)
        : await dataJudCandidateMatchService.match(payload)

      this.logger.info(formatResult(result))
      return
    }

    const job = await queueService.add(
      DATAJUD_MATCH_CANDIDATES_QUEUE,
      'datajud-match-candidates',
      payload,
      {
        jobId: `datajud-match-candidates-${this.tenantId}-${DateTime.utc().toMillis()}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    )

    this.logger.info(
      `DataJud candidate matching enqueued: ${JSON.stringify({
        tenantId: this.tenantId,
        jobId: job.id,
        source: this.source ?? null,
        limit: this.limit ?? null,
        candidatesPerAsset: this.candidatesPerAsset ?? null,
        persist: this.persist,
      })}`
    )

    await queueService.shutdown()
  }
}

function formatResult(result: Awaited<ReturnType<typeof dataJudCandidateMatchService.match>>) {
  return `DataJud candidate matching completed: ${JSON.stringify({
    stats: result.stats,
    topCandidates: result.matches.slice(0, 10).map((match) => ({
      assetId: match.assetId,
      requestedCnj: match.requestedCnj,
      candidateCnj: match.candidateCnj,
      courtAlias: match.courtAlias,
      score: match.score,
      signals: match.signals,
    })),
  })}`
}
