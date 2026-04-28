import factory from '@adonisjs/lucid/factories'
import PublicationEvent from '#modules/precatorios/models/publication_event'
import { DateTime } from 'luxon'
import { PublicationFactory } from '#database/factories/publication_factory'

export const PublicationEventFactory = factory
  .define(PublicationEvent, async () => {
    const publication = await PublicationFactory.create()

    return {
      tenantId: publication.tenantId,
      publicationId: publication.id,
      eventType: 'published',
      eventDate: DateTime.now(),
      payload: {},
    }
  })
  .build()
