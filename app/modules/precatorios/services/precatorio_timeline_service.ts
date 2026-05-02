import ProcessMatchCandidate from '#modules/integrations/models/process_match_candidate'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'

class PrecatorioTimelineService {
  async build(tenantId: string, assetId: string) {
    const asset = await PrecatorioAsset.query()
      .where('tenant_id', tenantId)
      .where('id', assetId)
      .whereNull('deleted_at')
      .preload('debtor')
      .preload('court')
      .preload('budgetUnit')
      .preload('sourceRecord')
      .preload('sourceLinks', (query) =>
        query
          .preload('sourceRecord')
          .preload('sourceDataset')
          .orderBy('last_seen_at', 'desc')
          .limit(50)
      )
      .preload('externalIdentifiers', (query) =>
        query
          .preload('sourceRecord')
          .preload('sourceDataset')
          .orderBy('is_primary', 'desc')
          .orderBy('identifier_type', 'asc')
      )
      .preload('valuations', (query) => query.orderBy('computed_at', 'desc').limit(20))
      .preload('budgetFacts', (query) => query.orderBy('created_at', 'desc').limit(20))
      .preload('events', (query) => query.orderBy('event_date', 'desc').limit(100))
      .preload('scores', (query) => query.orderBy('computed_at', 'desc').limit(20))
      .preload('judicialProcesses', (query) =>
        query
          .preload('sourceRecord')
          .preload('court')
          .preload('judicialClass')
          .preload('judgingBody')
          .preload('subjects')
          .preload('signals', (signalQuery) => signalQuery.orderBy('detected_at', 'desc').limit(50))
          .preload('movements', (movementQuery) =>
            movementQuery.orderBy('occurred_at', 'desc').limit(50)
          )
          .orderBy('created_at', 'desc')
          .limit(20)
      )
      .preload('publications', (query) =>
        query
          .preload('sourceRecord')
          .preload('events', (eventQuery) => eventQuery.orderBy('event_date', 'desc').limit(20))
          .orderBy('publication_date', 'desc')
          .limit(50)
      )
      .preload('cessionOpportunity', (query) => query.preload('currentPricing'))
      .firstOrFail()
    const processMatchCandidates = await ProcessMatchCandidate.query()
      .where('tenant_id', tenantId)
      .where('asset_id', assetId)
      .orderBy('score', 'desc')
      .orderBy('created_at', 'desc')
      .limit(50)

    return {
      asset: asset.serialize(),
      provenance: {
        primarySourceRecord: asset.sourceRecord?.serialize() ?? null,
        sourceLinks: asset.sourceLinks.map((link) => link.serialize()),
        externalIdentifiers: asset.externalIdentifiers.map((identifier) => identifier.serialize()),
      },
      processIntelligence: {
        judicialProcesses: asset.judicialProcesses.map((process) => process.serialize()),
        processMatchCandidates: processMatchCandidates.map((candidate) => candidate.serialize()),
      },
      legalSignals: {
        assetEvents: asset.events.map((event) => event.serialize()),
        publications: asset.publications.map((publication) => publication.serialize()),
        scores: asset.scores.map((score) => score.serialize()),
      },
      financialFacts: {
        valuations: asset.valuations.map((valuation) => valuation.serialize()),
        budgetFacts: asset.budgetFacts.map((fact) => fact.serialize()),
        opportunity: asset.cessionOpportunity?.serialize() ?? null,
      },
    }
  }
}

export default new PrecatorioTimelineService()
