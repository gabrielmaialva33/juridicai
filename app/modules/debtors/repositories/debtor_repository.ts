import BaseRepository from '#shared/repositories/base_repository'
import Debtor from '#modules/debtors/models/debtor'

class DebtorRepository extends BaseRepository<typeof Debtor> {
  constructor() {
    super(Debtor)
  }

  listForDashboard(tenantId: string, limit = 25) {
    return this.query(tenantId).orderBy('name', 'asc').limit(limit)
  }

  showWithAssets(tenantId: string, id: string) {
    return this.query(tenantId)
      .where('id', id)
      .preload('assets', (query) => {
        query.orderBy('created_at', 'desc').limit(50)
      })
      .firstOrFail()
  }

  findByNormalizedKey(tenantId: string, normalizedKey: string) {
    return this.query(tenantId).where('normalized_key', normalizedKey).first()
  }
}

export default new DebtorRepository()
