import precatorioRepository from '#modules/precatorios/repositories/precatorio_repository'
import type { PrecatorioListFilters } from '#modules/precatorios/repositories/precatorio_repository'

class PrecatorioService {
  list(tenantId: string, filters: PrecatorioListFilters) {
    return precatorioRepository.list(tenantId, filters)
  }

  show(tenantId: string, id: string) {
    return precatorioRepository.showWithDetails(tenantId, id)
  }
}

export default new PrecatorioService()
