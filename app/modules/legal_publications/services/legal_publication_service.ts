import { DateTime } from 'luxon'
import type {
  DeadlineKind,
  LegalPublicationOrigin,
} from '#modules/legal_publications/models/legal_publication'
import legalPublicationProcessLinkService from '#modules/legal_publications/services/legal_publication_process_link_service'
import legalPublicationAssetProjectionService from '#modules/legal_publications/services/legal_publication_asset_projection_service'
import legalPublicationDeadlineService from '#modules/legal_publications/services/legal_publication_deadline_service'
import legalPublicationInterpretationService from '#modules/legal_publications/services/legal_publication_interpretation_service'
import legalPublicationRepository from '#modules/legal_publications/repositories/legal_publication_repository'
import legalPublicationEventRepository from '#modules/legal_publications/repositories/legal_publication_event_repository'
import type { JsonRecord } from '#shared/types/model_enums'
import type { LegalPublicationDeadlineItem } from '#modules/legal_publications/services/legal_publication_deadline_service'

export type UpsertLegalPublicationInput = {
  tenantId: string
  djenId: string
  processNumber: string
  courtAlias?: string | null
  communicationType?: string | null
  courtBody?: string | null
  judicialClass?: string | null
  link?: string | null
  matchedBarRegistration?: string | null
  origin: LegalPublicationOrigin
  body: string
  textHash?: string | null
  rawData?: JsonRecord | null
  availableAt?: DateTime | null
  publishedAt?: DateTime | null
  monitoredCaseId?: string | null
  monitoredBarRegistrationId?: string | null
}

export type EditLegalPublicationInterpretationInput = {
  determination: string | null
  actType: string | null
  recommendedAction: string | null
  legalBasis: string | null
  deadlineDays: number | null
  deadlineKind: DeadlineKind | null
  hearingAt: string | null
  hearingTime: string | null
  judgmentAt: string | null
  priority: string | null
  notes: string | null
}

class LegalPublicationService {
  async upsertFromDjen(input: UpsertLegalPublicationInput) {
    const processLink = await legalPublicationProcessLinkService.resolve({
      tenantId: input.tenantId,
      processNumber: input.processNumber,
      courtAlias: input.courtAlias ?? null,
      rawData: input.rawData ?? null,
    })
    const existing = await legalPublicationRepository.findByDjenId(input.tenantId, input.djenId)
    const payload = {
      tenantId: input.tenantId,
      judicialProcessId: processLink.judicialProcess?.id ?? null,
      precatorioAssetId: processLink.precatorioAssetId,
      monitoredCaseId: input.monitoredCaseId ?? null,
      monitoredBarRegistrationId: input.monitoredBarRegistrationId ?? null,
      djenId: input.djenId,
      processNumber: processLink.normalizedCnj ?? input.processNumber,
      courtAlias: input.courtAlias ?? null,
      communicationType: input.communicationType ?? null,
      courtBody: input.courtBody ?? null,
      judicialClass: input.judicialClass ?? null,
      link: input.link ?? null,
      matchedBarRegistration: input.matchedBarRegistration ?? null,
      origin: input.origin,
      body: input.body,
      textHash: input.textHash ?? null,
      rawData: input.rawData ?? null,
      availableAt: input.availableAt ?? null,
      publishedAt: input.publishedAt ?? null,
    }

    const publication = await legalPublicationRepository.saveFromDjen(
      input.tenantId,
      existing,
      payload
    )

    if (!existing) {
      await legalPublicationEventRepository.createEvent(publication.tenantId, {
        legalPublicationId: publication.id,
        eventType: 'ingested',
        payload: {
          origin: publication.origin,
          judicialProcessId: publication.judicialProcessId,
          precatorioAssetId: publication.precatorioAssetId,
        },
      })
    }

    await legalPublicationInterpretationService.interpretAndPersist(publication)
    await legalPublicationDeadlineService.calculateAndPersist(publication)
    await legalPublicationAssetProjectionService.project(publication)

    return {
      publication,
      created: !existing,
    }
  }

  listRecent(tenantId: string, limit = 50) {
    return legalPublicationRepository.listRecent(tenantId, limit)
  }

  async listRecentForView(tenantId: string, limit = 50) {
    const publications = await this.listRecent(tenantId, limit)

    return publications.map((publication) => ({
      id: publication.id,
      processNumber: publication.processNumber,
      courtAlias: publication.courtAlias,
      communicationType: publication.communicationType,
      status: publication.status,
      availableAt: publication.availableAt?.toISODate() ?? null,
      dueAt: publication.dueAt?.toISODate() ?? null,
      manualDueAt: publication.manualDueAt?.toISODate() ?? null,
      manualReviewRequired: publication.manualReviewRequired,
      determination: publication.determination,
      actType: publication.actType,
      recommendedAction: publication.recommendedAction,
      legalBasis: publication.legalBasis,
      deadlineDays: publication.deadlineDays,
      deadlineKind: publication.deadlineKind,
      hearingAt: publication.hearingAt?.toISODate() ?? null,
      hearingTime: publication.hearingTime,
      judgmentAt: publication.judgmentAt?.toISODate() ?? null,
      priority: publication.priority,
      confidence: publication.confidence,
      validatorReason: publication.validatorReason,
      body: publication.body,
    }))
  }

  async listAgendaForView(tenantId: string, limit = 200) {
    const publications = await legalPublicationRepository.listAgendaSource(tenantId, limit)
    const todayIso = DateTime.local().toISODate()
    const events = publications.flatMap((publication) => {
      const items = deadlineItemsFrom(publication.deadlineItems)

      return items.map((item) => ({
        id: `${publication.id}:${item.kind}:${item.dueAt}`,
        publicationId: publication.id,
        type: item.kind,
        title: item.label,
        date: item.dueAt,
        time: item.time ?? null,
        fatal: item.fatal,
        overdue: item.fatal && todayIso ? item.dueAt < todayIso : false,
        processNumber: publication.processNumber,
        caseLabel: publication.monitoredCase?.label ?? null,
        courtAlias: publication.courtAlias,
        priority: publication.priority,
        manualReviewRequired: publication.manualReviewRequired,
      }))
    })

    return events.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 25)
  }

  async confirm(tenantId: string, publicationId: string, userId: string) {
    const publication = await legalPublicationRepository.findByIdOrFail(tenantId, publicationId)

    await legalPublicationRepository.markConfirmed(publication, userId)
    await legalPublicationEventRepository.createEvent(tenantId, {
      legalPublicationId: publication.id,
      eventType: 'confirmed',
      userId,
      payload: {
        status: publication.status,
      },
    })

    return publication
  }

  async dismiss(tenantId: string, publicationId: string, userId: string) {
    const publication = await legalPublicationRepository.findByIdOrFail(tenantId, publicationId)

    await legalPublicationRepository.markDismissed(publication)
    await legalPublicationEventRepository.createEvent(tenantId, {
      legalPublicationId: publication.id,
      eventType: 'dismissed',
      userId,
      payload: {
        status: publication.status,
      },
    })

    return publication
  }

  async editManualDeadline(
    tenantId: string,
    publicationId: string,
    userId: string,
    manualDueAt: string | null
  ) {
    const publication = await legalPublicationRepository.findByIdOrFail(tenantId, publicationId)
    const dueAt = parseIsoDate(manualDueAt)

    await legalPublicationRepository.applyManualDueDate(publication, dueAt)
    await legalPublicationDeadlineService.calculateAndPersist(publication)
    await legalPublicationEventRepository.createEvent(tenantId, {
      legalPublicationId: publication.id,
      eventType: 'deadline_edited',
      userId,
      payload: {
        manualDueAt: dueAt?.toISODate() ?? null,
        dueAt: publication.dueAt?.toISODate() ?? null,
      },
    })

    return publication
  }

  async editInterpretation(
    tenantId: string,
    publicationId: string,
    userId: string,
    input: EditLegalPublicationInterpretationInput
  ) {
    const publication = await legalPublicationRepository.findByIdOrFail(tenantId, publicationId)

    await legalPublicationRepository.applyManualInterpretation(publication, {
      determination: input.determination,
      actType: input.actType,
      recommendedAction: input.recommendedAction,
      legalBasis: input.legalBasis,
      deadlineDays: input.deadlineDays,
      deadlineKind: input.deadlineKind,
      hearingAt: parseIsoDate(input.hearingAt),
      hearingTime: input.hearingTime,
      judgmentAt: parseIsoDate(input.judgmentAt),
      priority: input.priority,
      notes: input.notes,
    })
    await legalPublicationDeadlineService.calculateAndPersist(publication)
    await legalPublicationEventRepository.createEvent(tenantId, {
      legalPublicationId: publication.id,
      eventType: 'interpretation_edited',
      userId,
      payload: {
        actType: publication.actType,
        deadlineDays: publication.deadlineDays,
        deadlineKind: publication.deadlineKind,
        hearingAt: publication.hearingAt?.toISODate() ?? null,
        judgmentAt: publication.judgmentAt?.toISODate() ?? null,
      },
    })

    return publication
  }
}

function deadlineItemsFrom(items: JsonRecord[] | null): LegalPublicationDeadlineItem[] {
  if (!items) {
    return []
  }

  return items.filter(isDeadlineItem)
}

function isDeadlineItem(item: JsonRecord): item is LegalPublicationDeadlineItem {
  return (
    typeof item.kind === 'string' &&
    ['deadline', 'manual_due_date', 'hearing', 'judgment'].includes(item.kind) &&
    typeof item.label === 'string' &&
    typeof item.dueAt === 'string' &&
    typeof item.fatal === 'boolean' &&
    typeof item.source === 'string'
  )
}

function parseIsoDate(value: string | null) {
  if (!value) {
    return null
  }

  return DateTime.fromISO(value, { zone: 'utc' }).startOf('day')
}

export default new LegalPublicationService()
