import factory from '@adonisjs/lucid/factories'
import PublicationEvent from '#modules/precatorios/models/publication_event'
import { DateTime } from 'luxon'
import { PublicationFactory } from '#database/factories/publication_factory'
import { ensureTenantId } from '#database/factories/factory_helpers'

export const PublicationEventFactory = factory
  .define(PublicationEvent, async () => {
    return {
      eventType: 'published',
      eventDate: DateTime.now(),
      payload: {},
    }
  })
  .before('create', async (_, row) => {
    const tenantId = await ensureTenantId(row)

    if (!row.publicationId) {
      const publication = await PublicationFactory.merge({ tenantId }).create()
      row.publicationId = publication.id
    }
  })
  .build()
