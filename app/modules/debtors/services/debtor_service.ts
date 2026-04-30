import debtorRepository from '#modules/debtors/repositories/debtor_repository'

class DebtorService {
  listForDashboard(tenantId: string) {
    return debtorRepository.listForDashboard(tenantId)
  }

  show(tenantId: string, id: string) {
    return debtorRepository.showWithAssets(tenantId, id)
  }
}

export default new DebtorService()
