import { createHash } from 'node:crypto'
import AssetEvent from '#modules/precatorios/models/asset_event'
import Publication from '#modules/precatorios/models/publication'
import PublicationEvent from '#modules/precatorios/models/publication_event'
import assetSignalScoreService from '#modules/precatorios/services/asset_signal_score_service'
import { classifyLegalSignalText } from '#modules/integrations/services/legal_signal_rules'
import type { JsonRecord } from '#shared/types/model_enums'

export type PublicationSignalClassifierOptions = {
  tenantId: string
  limit?: number | null
  publicationId?: string | null
  projectAssetEvents?: boolean
}

export type PublicationSignalClassifierMetrics = {
  selectedPublications: number
  matchedSignals: number
  publicationEventsUpserted: number
  assetEventsUpserted: number
  assetScoresRefreshed: number
  assetScoresCreated: number
}

const DEFAULT_LIMIT = 1_000
const MAX_LIMIT = 10_000

class PublicationSignalClassifierService {
  async classify(
    options: PublicationSignalClassifierOptions
  ): Promise<PublicationSignalClassifierMetrics> {
    const publications = await this.selectPublications(options)
    const metrics: PublicationSignalClassifierMetrics = {
      selectedPublications: publications.length,
      matchedSignals: 0,
      publicationEventsUpserted: 0,
      assetEventsUpserted: 0,
      assetScoresRefreshed: 0,
      assetScoresCreated: 0,
    }
    const affectedAssetIds = new Set<string>()

    for (const publication of publications) {
      const matches = classifyPublication(publication)
      metrics.matchedSignals += matches.length

      for (const match of matches) {
        const event = await this.upsertPublicationEvent(publication, match)
        metrics.publicationEventsUpserted += 1

        const assetId = publication.assetId ?? publication.process?.assetId ?? null
        if (options.projectAssetEvents !== false && assetId) {
          await this.upsertAssetEvent(assetId, publication, event, match)
          metrics.assetEventsUpserted += 1
          affectedAssetIds.add(assetId)
        }
      }
    }

    for (const assetId of affectedAssetIds) {
      const result = await assetSignalScoreService.refresh(options.tenantId, assetId)
      metrics.assetScoresRefreshed += 1
      if (result.created) {
        metrics.assetScoresCreated += 1
      }
    }

    return metrics
  }

  private selectPublications(options: PublicationSignalClassifierOptions) {
    const query = Publication.query()
      .where('tenant_id', options.tenantId)
      .preload('process')
      .orderBy('publication_date', 'desc')
      .orderBy('created_at', 'desc')
      .limit(normalizeLimit(options.limit))

    if (options.publicationId) {
      query.where('id', options.publicationId)
    }

    return query
  }

  private async upsertPublicationEvent(
    publication: Publication,
    match: ClassifiedPublicationSignal
  ) {
    const idempotencyKey = buildPublicationEventIdempotencyKey(publication, match.code)

    return PublicationEvent.updateOrCreate(
      {
        tenantId: publication.tenantId,
        idempotencyKey,
      },
      {
        tenantId: publication.tenantId,
        publicationId: publication.id,
        eventType: match.code,
        eventDate: publication.publicationDate.startOf('day'),
        payload: match.evidence,
        idempotencyKey,
      }
    )
  }

  private async upsertAssetEvent(
    assetId: string,
    publication: Publication,
    event: PublicationEvent,
    match: ClassifiedPublicationSignal
  ) {
    const idempotencyKey = `publication-signal:${event.idempotencyKey}`

    return AssetEvent.updateOrCreate(
      {
        tenantId: publication.tenantId,
        assetId,
        eventType: match.code,
        idempotencyKey,
      },
      {
        tenantId: publication.tenantId,
        assetId,
        eventType: match.code,
        eventDate: event.eventDate,
        source: publication.source,
        payload: {
          publicationEventId: event.id,
          publicationId: publication.id,
          processId: publication.processId,
          polarity: match.polarity,
          confidence: match.confidence,
          evidence: match.evidence,
        },
        idempotencyKey,
      }
    )
  }
}

type ClassifiedPublicationSignal = {
  code: string
  polarity: 'positive' | 'negative'
  confidence: number
  evidence: JsonRecord
}

function classifyPublication(publication: Publication): ClassifiedPublicationSignal[] {
  return classifyLegalSignalText({
    text: buildPublicationText(publication),
  }).map((match) => ({
    code: match.code,
    polarity: match.polarity,
    confidence: match.confidence,
    evidence: {
      publicationId: publication.id,
      processId: publication.processId,
      assetId: publication.assetId,
      source: publication.source,
      publicationDate: publication.publicationDate.toISODate(),
      title: publication.title,
      matchedBy: match.matchedBy,
    },
  }))
}

function buildPublicationText(publication: Publication) {
  return [
    publication.title,
    publication.body,
    publication.rawData ? JSON.stringify(publication.rawData) : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function buildPublicationEventIdempotencyKey(publication: Publication, signalCode: string) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        source: 'publication',
        publicationId: publication.id,
        signalCode,
      })
    )
    .digest('hex')
}

function normalizeLimit(value?: number | null) {
  if (!value || value < 1) {
    return DEFAULT_LIMIT
  }

  return Math.min(Math.floor(value), MAX_LIMIT)
}

export default new PublicationSignalClassifierService()
