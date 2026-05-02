import precatorioRepository from '#modules/precatorios/repositories/precatorio_repository'
import precatorioTimelineService from '#modules/precatorios/services/precatorio_timeline_service'
import type { PrecatorioListFilters } from '#modules/precatorios/repositories/precatorio_repository'

class PrecatorioService {
  list(tenantId: string, filters: PrecatorioListFilters) {
    return precatorioRepository.list(tenantId, filters)
  }

  show(tenantId: string, id: string) {
    return precatorioRepository.showWithDetails(tenantId, id)
  }

  timeline(tenantId: string, id: string) {
    return precatorioTimelineService.build(tenantId, id)
  }
}

export default new PrecatorioService()
