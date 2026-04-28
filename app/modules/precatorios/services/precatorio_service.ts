import precatorioRepository from '#modules/precatorios/repositories/precatorio_repository'

class PrecatorioService {
  listLatest(tenantId: string, page = 1, perPage = 25) {
    return precatorioRepository.listLatest(tenantId, page, perPage)
  }

  show(tenantId: string, id: string) {
    return precatorioRepository.findByIdOrFail(tenantId, id)
  }
}

export default new PrecatorioService()
