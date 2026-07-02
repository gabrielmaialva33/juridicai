import BaseRepository from '#shared/repositories/base_repository'
import LegalPublicationEvent, {
  type LegalPublicationEventType,
} from '#modules/legal_publications/models/legal_publication_event'
import type { JsonRecord } from '#shared/types/model_enums'

class LegalPublicationEventRepository extends BaseRepository<typeof LegalPublicationEvent> {
  constructor() {
    super(LegalPublicationEvent)
  }

  createEvent(
    tenantId: string,
    input: {
      legalPublicationId: string
      eventType: LegalPublicationEventType
      payload?: JsonRecord | null
      userId?: string | null
    }
  ) {
    return this.create(tenantId, {
      legalPublicationId: input.legalPublicationId,
      eventType: input.eventType,
      payload: input.payload ?? null,
      userId: input.userId ?? null,
    })
  }
}

export default new LegalPublicationEventRepository()
