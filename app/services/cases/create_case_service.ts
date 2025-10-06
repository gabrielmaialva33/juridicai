import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import CasesRepository from '#repositories/cases_repository'
import ICase from '#interfaces/case_interface'
import Case from '#models/case'

/**
 * Service for creating a new case
 *
 * @class CreateCaseService
 * @example
 * const service = await app.container.make(CreateCaseService)
 * const case = await service.run(payload)
 */
@inject()
export default class CreateCaseService {
  constructor(private casesRepository: CasesRepository) {}

  /**
   * Create a new case
   *
   * @param payload - Case creation payload from validator
   * @returns Created case instance
   */
  async run(payload: ICase.CreatePayload): Promise<Case> {
    // Convert Date fields to DateTime if they exist
    const data: any = { ...payload }

    if (payload.filed_at) {
      data.filed_at = DateTime.fromJSDate(new Date(payload.filed_at))
    }

    return this.casesRepository.create(data)
  }
}
