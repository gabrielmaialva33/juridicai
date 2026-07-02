import BaseRepository from '#shared/repositories/base_repository'
import LegalPublication, {
  type DeadlineKind,
  type LegalPublicationOrigin,
} from '#modules/legal_publications/models/legal_publication'
import type { DateTime } from 'luxon'
import type { JsonRecord } from '#shared/types/model_enums'
import type { DeadlineCalculationResult } from '#modules/legal_publications/services/legal_publication_deadline_service'
import type { LegalPublicationInterpretationResult } from '#modules/legal_publications/services/legal_publication_interpretation_service'

export type LegalPublicationPersistencePayload = {
  judicialProcessId: string | null
  precatorioAssetId: string | null
  monitoredCaseId: string | null
  monitoredBarRegistrationId: string | null
  djenId: string
  processNumber: string
  courtAlias: string | null
  communicationType: string | null
  courtBody: string | null
  judicialClass: string | null
  link: string | null
  matchedBarRegistration: string | null
  origin: LegalPublicationOrigin
  body: string
  textHash: string | null
  rawData: JsonRecord | null
  availableAt: DateTime | null
  publishedAt: DateTime | null
}

class LegalPublicationRepository extends BaseRepository<typeof LegalPublication> {
  constructor() {
    super(LegalPublication)
  }

  listRecent(tenantId: string, limit = 50) {
    return this.query(tenantId).orderBy('available_at', 'desc').limit(limit)
  }

  findByDjenId(tenantId: string, djenId: string) {
    return this.query(tenantId).where('djen_id', djenId).first()
  }

  async saveFromDjen(
    tenantId: string,
    publication: LegalPublication | null,
    payload: LegalPublicationPersistencePayload
  ) {
    const row = publication ?? new LegalPublication()
    row.merge({ ...payload, tenantId })
    await row.save()
    return row
  }

  async applyDeadlineCalculation(
    publication: LegalPublication,
    calculation: DeadlineCalculationResult
  ) {
    publication.merge({
      publishedAt: calculation.publishedAt,
      dueAt: calculation.dueAt,
      overdue: calculation.overdue,
      partialCalendar: calculation.partialCalendar,
      manualReviewRequired: publication.manualReviewRequired || calculation.manualReviewRequired,
      deadlineReason: calculation.deadlineReason,
      deadlineItems: calculation.deadlineItems,
    })
    await publication.save()
    return publication
  }

  async applyInterpretation(
    publication: LegalPublication,
    interpretation: LegalPublicationInterpretationResult
  ) {
    publication.merge({
      determination: interpretation.determination,
      branch: interpretation.branch,
      actType: interpretation.actType,
      recommendedAction: interpretation.recommendedAction,
      legalBasis: interpretation.legalBasis,
      deadlineDays: interpretation.deadlineDays,
      deadlineKind: interpretation.deadlineKind as DeadlineKind | null,
      labels: interpretation.labels,
      hearingAt: interpretation.hearingAt,
      hearingTime: interpretation.hearingTime,
      judgmentAt: interpretation.judgmentAt,
      priority: interpretation.priority,
      confidence: interpretation.confidence,
      notes: interpretation.notes,
      manualReviewRequired: publication.manualReviewRequired || interpretation.manualReviewRequired,
      validatorFailed: interpretation.validatorFailed,
      validatorReason: interpretation.validatorReason,
      deadlineReason: interpretation.deadlineReason ?? publication.deadlineReason,
      processedAt: interpretation.processedAt,
    })
    await publication.save()
    return publication
  }
}

export default new LegalPublicationRepository()
