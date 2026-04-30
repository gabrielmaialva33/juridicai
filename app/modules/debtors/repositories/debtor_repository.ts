import BaseRepository from '#shared/repositories/base_repository'
import Debtor from '#modules/debtors/models/debtor'
import type { DebtorType, PaymentRegime } from '#shared/types/model_enums'

export type DebtorListFilters = {
  page: number
  limit: number
  q?: string | null
  debtorType?: DebtorType | null
  stateCode?: string | null
  paymentRegime?: PaymentRegime | null
  sortBy: 'name' | 'payment_reliability_score' | 'created_at'
  sortDirection: 'asc' | 'desc'
}

class DebtorRepository extends BaseRepository<typeof Debtor> {
  constructor() {
    super(Debtor)
  }

  list(tenantId: string, filters: DebtorListFilters) {
    const query = this.query(tenantId)

    if (filters.q) {
      const term = `%${filters.q.toLowerCase()}%`
      query.where((builder) => {
        builder
          .whereRaw('lower(name) like ?', [term])
          .orWhereRaw('lower(normalized_name) like ?', [term])
          .orWhereRaw('coalesce(cnpj, ?) like ?', ['', `%${filters.q}%`])
      })
    }

    if (filters.debtorType) query.where('debtor_type', filters.debtorType)
    if (filters.stateCode) query.where('state_code', filters.stateCode)
    if (filters.paymentRegime) query.where('payment_regime', filters.paymentRegime)

    return query
      .orderBy(filters.sortBy, filters.sortDirection)
      .orderBy('id', 'asc')
      .paginate(filters.page, filters.limit)
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
