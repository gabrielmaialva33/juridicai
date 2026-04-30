import debtorRepository from '#modules/debtors/repositories/debtor_repository'
import type { DebtorListFilters } from '#modules/debtors/repositories/debtor_repository'

class DebtorService {
  list(tenantId: string, filters: DebtorListFilters) {
    return debtorRepository.list(tenantId, filters)
  }

  show(tenantId: string, id: string) {
    return debtorRepository.showWithAssets(tenantId, id)
  }
}

export default new DebtorService()
