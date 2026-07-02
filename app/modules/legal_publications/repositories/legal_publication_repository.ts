import BaseRepository from '#shared/repositories/base_repository'
import LegalPublication, {
  type DeadlineKind,
  type LegalPublicationOrigin,
} from '#modules/legal_publications/models/legal_publication'
import { DateTime } from 'luxon'
import type { JsonRecord } from '#shared/types/model_enums'
import type { DeadlineCalculationResult } from '#modules/legal_publications/services/legal_publication_deadline_service'
import type { LegalPublicationInterpretationResult } from '#modules/legal_publications/services/legal_publication_interpretation_service'

export type LegalPublicationManualInterpretationPayload = {
  determination: string | null
  actType: string | null
  recommendedAction: string | null
  legalBasis: string | null
  deadlineDays: number | null
  deadlineKind: DeadlineKind | null
  hearingAt: DateTime | null
  hearingTime: string | null
  judgmentAt: DateTime | null
  priority: string | null
  notes: string | null
}

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

  listAgendaSource(tenantId: string, limit = 200) {
    return this.query(tenantId)
      .whereNot('status', 'dismissed')
      .where((query) => {
        query
          .whereNotNull('manual_due_at')
          .orWhereNotNull('due_at')
          .orWhereNotNull('hearing_at')
          .orWhereNotNull('judgment_at')
      })
      .preload('monitoredCase')
      .orderByRaw('coalesce(manual_due_at, due_at, hearing_at, judgment_at, available_at) asc')
      .limit(limit)
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
      businessDaysUntilHearing: calculation.businessDaysUntilHearing,
      hearingElapsed: calculation.hearingElapsed,
    })
    await publication.save()
    return publication
  }

  async applyManualDueDate(publication: LegalPublication, manualDueAt: DateTime | null) {
    publication.manualDueAt = manualDueAt
    publication.manualReviewRequired = false
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

  async applyManualInterpretation(
    publication: LegalPublication,
    payload: LegalPublicationManualInterpretationPayload
  ) {
    publication.merge({
      ...payload,
      confidence: 'high',
      validatorFailed: false,
      validatorReason: null,
      manualReviewRequired: false,
    })
    await publication.save()
    return publication
  }

  async markConfirmed(publication: LegalPublication, userId: string) {
    publication.merge({
      status: 'confirmed',
      confirmedByUserId: userId,
      confirmedAt: DateTime.utc(),
      manualReviewRequired: false,
    })
    await publication.save()
    return publication
  }

  async markDismissed(publication: LegalPublication) {
    publication.merge({
      status: 'dismissed',
    })
    await publication.save()
    return publication
  }
}

export default new LegalPublicationRepository()
