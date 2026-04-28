import db from '@adonisjs/lucid/services/db'

class MetricsRepository {
  async assetMetrics(tenantId: string) {
    return db.from('dashboard_asset_metrics').where('tenant_id', tenantId).first()
  }

  async debtorAggregates(tenantId: string) {
    return db.from('debtor_aggregates').where('tenant_id', tenantId).orderBy('name', 'asc')
  }
}

export default new MetricsRepository()
