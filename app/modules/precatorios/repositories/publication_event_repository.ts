import BaseRepository from '#shared/repositories/base_repository'
import PublicationEvent from '#modules/precatorios/models/publication_event'
import type { DateTime } from 'luxon'
import type { JsonRecord } from '#shared/types/model_enums'

class PublicationEventRepository extends BaseRepository<typeof PublicationEvent> {
  constructor() {
    super(PublicationEvent)
  }

  upsertEvent(
    tenantId: string,
    input: {
      publicationId: string
      eventType: string
      eventDate: DateTime
      payload: JsonRecord
      idempotencyKey: string
    }
  ) {
    return PublicationEvent.updateOrCreate(
      {
        tenantId,
        idempotencyKey: input.idempotencyKey,
      },
      {
        tenantId,
        publicationId: input.publicationId,
        eventType: input.eventType,
        eventDate: input.eventDate,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey,
      }
    )
  }
}

export default new PublicationEventRepository()
