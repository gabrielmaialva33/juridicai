import type LegalPublication from '#modules/legal_publications/models/legal_publication'
import legalPublicationAssetEventRepository from '#modules/legal_publications/repositories/legal_publication_asset_event_repository'
import legalPublicationEventRepository from '#modules/legal_publications/repositories/legal_publication_event_repository'

class LegalPublicationAssetProjectionService {
  async project(publication: LegalPublication) {
    if (!publication.precatorioAssetId) {
      return { projected: false }
    }

    const idempotencyKey = `legal-publication:${publication.id}`
    const existing = await legalPublicationAssetEventRepository.findProjectedLegalPublicationEvent(
      publication.tenantId,
      {
        assetId: publication.precatorioAssetId,
        idempotencyKey,
      }
    )

    if (existing) {
      return { projected: false }
    }

    await legalPublicationAssetEventRepository.createLegalPublicationDetected(
      publication.tenantId,
      {
        assetId: publication.precatorioAssetId,
        idempotencyKey,
        payload: {
          legalPublicationId: publication.id,
          judicialProcessId: publication.judicialProcessId,
          djenId: publication.djenId,
          processNumber: publication.processNumber,
          courtAlias: publication.courtAlias,
          actType: publication.actType,
          dueAt: publication.dueAt?.toISODate() ?? null,
          manualReviewRequired: publication.manualReviewRequired,
        },
      }
    )

    await legalPublicationEventRepository.createEvent(publication.tenantId, {
      legalPublicationId: publication.id,
      eventType: 'projected_to_asset',
      payload: {
        assetId: publication.precatorioAssetId,
        eventType: 'legal_publication_detected',
      },
    })

    return { projected: true }
  }
}

export default new LegalPublicationAssetProjectionService()
