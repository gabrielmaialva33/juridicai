import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import CasesRepository from '#repositories/cases_repository'
import ICase from '#interfaces/case_interface'
import Case from '#models/case'
import NotFoundException from '#exceptions/not_found_exception'

/**
 * Service for updating an existing case
 *
 * @class UpdateCaseService
 * @example
 * const service = await app.container.make(UpdateCaseService)
 * const case = await service.run(caseId, payload)
 */
@inject()
export default class UpdateCaseService {
  constructor(private casesRepository: CasesRepository) {}

  /**
   * Update an existing case
   *
   * @param caseId - The case ID to update
   * @param payload - Case update payload from validator
   * @returns Updated case instance
   * @throws {NotFoundException} if case not found
   */
  async run(caseId: number, payload: ICase.EditPayload): Promise<Case> {
    const caseInstance = await this.casesRepository.findBy('id', caseId)

    if (!caseInstance) {
      throw new NotFoundException('Case not found')
    }

    // Convert Date fields to DateTime if they exist
    const data = { ...payload }

    if (payload.filed_at) {
      (data as any).filed_at = DateTime.fromJSDate(new Date(payload.filed_at))
    }

    if (payload.closed_at) {
      (data as any).closed_at = DateTime.fromJSDate(new Date(payload.closed_at))
    }

    caseInstance.merge(data as any)
    await caseInstance.save()

    return caseInstance
  }
}
