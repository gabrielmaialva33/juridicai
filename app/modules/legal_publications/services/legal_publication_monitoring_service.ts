import type { ClientPartySide } from '#modules/legal_publications/models/monitored_case'
import monitoredCaseRepository from '#modules/legal_publications/repositories/monitored_case_repository'
import monitoredBarRegistrationRepository from '#modules/legal_publications/repositories/monitored_bar_registration_repository'
import legalPublicationRepository from '#modules/legal_publications/repositories/legal_publication_repository'

export class LegalPublicationMonitoringConflictError extends Error {}

export type MonitoredCaseInput = {
  cnjNumber: string
  label: string | null
  clientPartySide: ClientPartySide | null
  monitoredBarRegistrationId?: string | null
}

export type MonitoredBarRegistrationInput = {
  barNumber: string
  stateCode: string
  lawyerName: string | null
}

class LegalPublicationMonitoringService {
  async viewModel(tenantId: string) {
    const [cases, registrations] = await Promise.all([
      monitoredCaseRepository.listForMonitoring(tenantId),
      monitoredBarRegistrationRepository.listForMonitoring(tenantId),
    ])
    const [caseSummaries, registrationSummaries] = await Promise.all([
      legalPublicationRepository.summarizeByMonitoredCaseIds(
        tenantId,
        cases.map((monitoredCase) => monitoredCase.id)
      ),
      legalPublicationRepository.summarizeByMonitoredBarRegistrationIds(
        tenantId,
        registrations.map((registration) => registration.id)
      ),
    ])
    const caseRows = cases.map((monitoredCase) => {
      const summary = caseSummaries.get(monitoredCase.id)

      return {
        id: monitoredCase.id,
        cnjNumber: monitoredCase.cnjNumber,
        label: monitoredCase.label,
        clientPartySide: monitoredCase.clientPartySide,
        active: monitoredCase.active,
        monitoredBarRegistrationId: monitoredCase.monitoredBarRegistrationId,
        monitoredBarRegistration: monitoredCase.monitoredBarRegistration
          ? {
              id: monitoredCase.monitoredBarRegistration.id,
              barNumber: monitoredCase.monitoredBarRegistration.barNumber,
              stateCode: monitoredCase.monitoredBarRegistration.stateCode,
              lawyerName: monitoredCase.monitoredBarRegistration.lawyerName,
            }
          : null,
        publicationCount: summary?.publicationCount ?? 0,
        latestAvailableAt: summary?.latestAvailableAt ?? null,
      }
    })
    const registrationRows = registrations.map((registration) => {
      const summary = registrationSummaries.get(registration.id)

      return {
        id: registration.id,
        barNumber: registration.barNumber,
        stateCode: registration.stateCode,
        lawyerName: registration.lawyerName,
        active: registration.active,
        publicationCount: summary?.publicationCount ?? 0,
        latestAvailableAt: summary?.latestAvailableAt ?? null,
      }
    })

    return {
      cases: caseRows,
      barRegistrations: registrationRows,
      summary: {
        activeCases: caseRows.filter((row) => row.active).length,
        activeBarRegistrations: registrationRows.filter((row) => row.active).length,
        capturedPublications:
          caseRows.reduce((total, row) => total + row.publicationCount, 0) +
          registrationRows.reduce((total, row) => total + row.publicationCount, 0),
      },
    }
  }

  async createCase(tenantId: string, input: MonitoredCaseInput) {
    await this.assertUniqueCase(tenantId, input.cnjNumber)
    return monitoredCaseRepository.createForMonitoring(tenantId, input)
  }

  async updateCase(tenantId: string, id: string, input: MonitoredCaseInput) {
    await this.assertUniqueCase(tenantId, input.cnjNumber, id)
    return monitoredCaseRepository.updateForMonitoring(tenantId, id, input)
  }

  async setCaseActive(tenantId: string, id: string, active: boolean) {
    return monitoredCaseRepository.setActive(tenantId, id, active)
  }

  async createBarRegistration(tenantId: string, input: MonitoredBarRegistrationInput) {
    await this.assertUniqueRegistration(tenantId, input.barNumber, input.stateCode)
    return monitoredBarRegistrationRepository.createForMonitoring(tenantId, input)
  }

  async updateBarRegistration(tenantId: string, id: string, input: MonitoredBarRegistrationInput) {
    await this.assertUniqueRegistration(tenantId, input.barNumber, input.stateCode, id)
    return monitoredBarRegistrationRepository.updateForMonitoring(tenantId, id, input)
  }

  async setBarRegistrationActive(tenantId: string, id: string, active: boolean) {
    return monitoredBarRegistrationRepository.setActive(tenantId, id, active)
  }

  private async assertUniqueCase(tenantId: string, cnjNumber: string, excludeId?: string) {
    const duplicate = await monitoredCaseRepository.findDuplicate(tenantId, cnjNumber, excludeId)

    if (duplicate) {
      throw new LegalPublicationMonitoringConflictError('This case is already monitored.')
    }
  }

  private async assertUniqueRegistration(
    tenantId: string,
    barNumber: string,
    stateCode: string,
    excludeId?: string
  ) {
    const duplicate = await monitoredBarRegistrationRepository.findDuplicate(
      tenantId,
      barNumber,
      stateCode,
      excludeId
    )

    if (duplicate) {
      throw new LegalPublicationMonitoringConflictError(
        'This bar registration is already monitored.'
      )
    }
  }
}

export default new LegalPublicationMonitoringService()
