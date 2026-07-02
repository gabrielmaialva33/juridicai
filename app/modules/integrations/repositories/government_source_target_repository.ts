import GovernmentSourceTarget from '#modules/integrations/models/government_source_target'
import type { GovernmentSourceTargetStatus } from '#shared/types/model_enums'

class GovernmentSourceTargetRepository {
  query() {
    return GovernmentSourceTarget.query()
  }

  listActive() {
    return this.query().where('is_active', true).orderBy('priority', 'asc').orderBy('name', 'asc')
  }

  listActiveWithDataset() {
    return this.query()
      .where('is_active', true)
      .preload('sourceDataset')
      .orderBy('priority', 'asc')
      .orderBy('name', 'asc')
  }

  async listForSync(input: {
    targetKeys?: string[] | null
    courtAliases?: string[] | null
    adapterKeys?: string[] | null
    statuses?: GovernmentSourceTargetStatus[] | null
    sourceDatasetIds?: string[] | null
    limit?: number | null
  }) {
    const query = this.query().where('is_active', true).preload('sourceDataset')

    if (input.targetKeys?.length) {
      query.whereIn('key', input.targetKeys)
    }

    if (input.courtAliases?.length) {
      query.whereIn('court_alias', input.courtAliases)
    }

    if (input.adapterKeys?.length) {
      query.whereIn('adapter_key', input.adapterKeys)
    }

    if (input.statuses?.length) {
      query.whereIn('status', input.statuses)
    }

    if (input.sourceDatasetIds?.length) {
      query.whereIn('source_dataset_id', input.sourceDatasetIds)
    }

    query.orderByRaw(`
      case priority
        when 'primary' then 1
        when 'enrichment' then 2
        else 3
      end
    `)
    query.orderBy('court_alias', 'asc')
    query.orderBy('key', 'asc')

    if (input.limit && input.limit > 0) {
      query.limit(Math.trunc(input.limit))
    }

    return query.exec()
  }
}

export default new GovernmentSourceTargetRepository()
