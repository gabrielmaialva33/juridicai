import type { HttpContext } from '@adonisjs/core/http'
import tenantContext from '#shared/helpers/tenant_context'
import legalPublicationService from '#modules/legal_publications/services/legal_publication_service'

export default class LegalPublicationsController {
  async index({ inertia }: HttpContext) {
    const tenantId = tenantContext.requireTenantId()

    return inertia.render('legal_publications/index', {
      publications: await legalPublicationService.listRecentForView(tenantId),
      agenda: await legalPublicationService.listAgendaForView(tenantId),
    })
  }
}
