import SourceDataset from '#modules/integrations/models/source_dataset'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

class SourceDatasetRepository {
  query(trx?: TransactionClientContract) {
    return trx ? SourceDataset.query({ client: trx }) : SourceDataset.query()
  }

  findByKey(key: string, trx?: TransactionClientContract) {
    return this.query(trx).where('key', key).first()
  }

  async findIdByKey(key: string, trx?: TransactionClientContract) {
    const dataset = await this.findByKey(key, trx)
    return dataset?.id ?? null
  }

  async findIdByKeyOrFail(key: string) {
    const dataset = await this.query().where('key', key).firstOrFail()
    return dataset.id
  }

  listActive() {
    return this.query().where('is_active', true).orderBy('priority', 'asc').orderBy('name', 'asc')
  }

  async idsByKeys(keys: string[]) {
    const datasets = await this.query().whereIn('key', keys).select('id')
    return datasets.map((dataset) => dataset.id)
  }
}

export default new SourceDatasetRepository()
