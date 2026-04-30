import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import dataJudCandidateReviewService, {
  DataJudCandidateReviewError,
} from '#modules/integrations/services/datajud_candidate_review_service'

export default class DataJudReviewCandidate extends BaseCommand {
  static commandName = 'datajud:review-candidate'
  static description = 'Accept or reject a persisted DataJud process match candidate'
  static options = {
    startApp: true,
  }

  @args.string({
    description: 'process_match_candidates.id to review',
  })
  declare candidateId: string

  @args.string({
    description: 'Review decision: accept or reject',
  })
  declare decision: string

  @flags.boolean({
    description: 'Allow accepting a candidate below the default score threshold',
  })
  declare force: boolean

  async run() {
    try {
      if (this.decision === 'accept') {
        const result = await dataJudCandidateReviewService.accept(this.candidateId, {
          force: this.force,
        })

        this.logger.info(
          `DataJud candidate accepted: ${JSON.stringify({
            candidateId: result.candidate.id,
            assetId: result.candidate.assetId,
            candidateCnj: result.candidate.candidateCnj,
            judicialProcessId: result.judicialProcess.id,
            score: result.candidate.score,
          })}`
        )
        return
      }

      if (this.decision === 'reject') {
        const candidate = await dataJudCandidateReviewService.reject(this.candidateId)
        this.logger.info(
          `DataJud candidate rejected: ${JSON.stringify({
            candidateId: candidate.id,
            assetId: candidate.assetId,
            candidateCnj: candidate.candidateCnj,
            score: candidate.score,
          })}`
        )
        return
      }

      this.logger.error('decision must be "accept" or "reject".')
      this.exitCode = 1
    } catch (error) {
      if (error instanceof DataJudCandidateReviewError) {
        this.logger.error(error.message)
        this.exitCode = 1
        return
      }

      throw error
    }
  }
}
