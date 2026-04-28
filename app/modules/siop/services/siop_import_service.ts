import siopImportRepository from '#modules/siop/repositories/siop_import_repository'

class SiopImportService {
  listRecentImports(tenantId: string) {
    return siopImportRepository.listRecent(tenantId)
  }
}

export default new SiopImportService()
