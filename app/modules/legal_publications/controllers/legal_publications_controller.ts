import type { HttpContext } from '@adonisjs/core/http'
import tenantContext from '#shared/helpers/tenant_context'
import legalPublicationService from '#modules/legal_publications/services/legal_publication_service'
import {
  legalPublicationInterpretationEditValidator,
  legalPublicationManualDeadlineValidator,
} from '#modules/legal_publications/validators/legal_publication_actions_validator'

export default class LegalPublicationsController {
  async index({ inertia }: HttpContext) {
    const tenantId = tenantContext.requireTenantId()

    return inertia.render('legal_publications/index', {
      publications: await legalPublicationService.listRecentForView(tenantId),
      agenda: await legalPublicationService.listAgendaForView(tenantId),
    })
  }

  async confirm({ auth, params, response }: HttpContext) {
    await legalPublicationService.confirm(tenantContext.requireTenantId(), params.id, auth.user!.id)

    return response.redirect().back()
  }

  async dismiss({ auth, params, response }: HttpContext) {
    await legalPublicationService.dismiss(tenantContext.requireTenantId(), params.id, auth.user!.id)

    return response.redirect().back()
  }

  async updateDeadline({ auth, params, request, response }: HttpContext) {
    const payload = await request.validateUsing(legalPublicationManualDeadlineValidator)

    await legalPublicationService.editManualDeadline(
      tenantContext.requireTenantId(),
      params.id,
      auth.user!.id,
      payload.manualDueAt
    )

    return response.redirect().back()
  }

  async updateInterpretation({ auth, params, request, response }: HttpContext) {
    const payload = await request.validateUsing(legalPublicationInterpretationEditValidator)

    await legalPublicationService.editInterpretation(
      tenantContext.requireTenantId(),
      params.id,
      auth.user!.id,
      payload
    )

    return response.redirect().back()
  }
}
