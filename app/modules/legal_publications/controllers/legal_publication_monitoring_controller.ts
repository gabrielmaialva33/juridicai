import type { HttpContext } from '@adonisjs/core/http'
import tenantContext from '#shared/helpers/tenant_context'
import legalPublicationMonitoringService, {
  LegalPublicationMonitoringConflictError,
} from '#modules/legal_publications/services/legal_publication_monitoring_service'
import {
  monitoredBarRegistrationValidator,
  monitoredCaseValidator,
  monitoringActiveToggleValidator,
} from '#modules/legal_publications/validators/legal_publication_monitoring_validator'

export default class LegalPublicationMonitoringController {
  async index({ inertia }: HttpContext) {
    return inertia.render(
      'legal_publications/monitoring',
      await legalPublicationMonitoringService.viewModel(tenantContext.requireTenantId())
    )
  }

  async storeCase({ request, response, session }: HttpContext) {
    const payload = await request.validateUsing(monitoredCaseValidator)

    try {
      await legalPublicationMonitoringService.createCase(tenantContext.requireTenantId(), payload)
      session.flash('success', 'Case monitoring created.')
    } catch (error) {
      if (error instanceof LegalPublicationMonitoringConflictError) {
        session.flash('error', error.message)
        return response.redirect().back()
      }

      throw error
    }

    return response.redirect().back()
  }

  async updateCase({ params, request, response, session }: HttpContext) {
    const payload = await request.validateUsing(monitoredCaseValidator)

    try {
      await legalPublicationMonitoringService.updateCase(
        tenantContext.requireTenantId(),
        params.id,
        payload
      )
      session.flash('success', 'Case monitoring updated.')
    } catch (error) {
      if (error instanceof LegalPublicationMonitoringConflictError) {
        session.flash('error', error.message)
        return response.redirect().back()
      }

      throw error
    }

    return response.redirect().back()
  }

  async toggleCase({ params, request, response }: HttpContext) {
    const payload = await request.validateUsing(monitoringActiveToggleValidator)

    await legalPublicationMonitoringService.setCaseActive(
      tenantContext.requireTenantId(),
      params.id,
      payload.active
    )

    return response.redirect().back()
  }

  async storeBarRegistration({ request, response, session }: HttpContext) {
    const payload = await request.validateUsing(monitoredBarRegistrationValidator)

    try {
      await legalPublicationMonitoringService.createBarRegistration(
        tenantContext.requireTenantId(),
        normalizeBarRegistrationPayload(payload)
      )
      session.flash('success', 'Bar registration monitoring created.')
    } catch (error) {
      if (error instanceof LegalPublicationMonitoringConflictError) {
        session.flash('error', error.message)
        return response.redirect().back()
      }

      throw error
    }

    return response.redirect().back()
  }

  async updateBarRegistration({ params, request, response, session }: HttpContext) {
    const payload = await request.validateUsing(monitoredBarRegistrationValidator)

    try {
      await legalPublicationMonitoringService.updateBarRegistration(
        tenantContext.requireTenantId(),
        params.id,
        normalizeBarRegistrationPayload(payload)
      )
      session.flash('success', 'Bar registration monitoring updated.')
    } catch (error) {
      if (error instanceof LegalPublicationMonitoringConflictError) {
        session.flash('error', error.message)
        return response.redirect().back()
      }

      throw error
    }

    return response.redirect().back()
  }

  async toggleBarRegistration({ params, request, response }: HttpContext) {
    const payload = await request.validateUsing(monitoringActiveToggleValidator)

    await legalPublicationMonitoringService.setBarRegistrationActive(
      tenantContext.requireTenantId(),
      params.id,
      payload.active
    )

    return response.redirect().back()
  }
}

function normalizeBarRegistrationPayload(payload: {
  barNumber: string
  stateCode: string
  lawyerName: string | null
}) {
  return {
    ...payload,
    stateCode: payload.stateCode.toUpperCase(),
  }
}
