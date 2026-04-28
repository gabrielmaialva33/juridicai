import siopImportService from '#modules/siop/services/siop_import_service'
import tenantContext from '#shared/helpers/tenant_context'
import type { HttpContext } from '@adonisjs/core/http'

export default class ImportController {
  async index({ response }: HttpContext) {
    const imports = await siopImportService.listRecentImports(tenantContext.requireTenantId())

    return response.ok({
      imports: imports.map((importRow) => importRow.serialize()),
    })
  }
}
