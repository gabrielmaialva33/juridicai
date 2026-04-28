import debtorRepository from '#modules/debtors/repositories/debtor_repository'

class DebtorService {
  listForDashboard(tenantId: string) {
    return debtorRepository.listForDashboard(tenantId)
  }
}

export default new DebtorService()
