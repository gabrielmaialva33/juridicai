import { DateTime } from 'luxon'
import type { LegalPublicationOrigin } from '#modules/legal_publications/models/legal_publication'
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
      manualReviewRequired: publication.manualReviewRequired,
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

export default new LegalPublicationService()
