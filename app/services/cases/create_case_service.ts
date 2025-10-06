import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import CasesRepository from '#repositories/cases_repository'
import ClientsRepository from '#repositories/clients_repository'
import UsersRepository from '#repositories/users_repository'
import NotFoundException from '#exceptions/not_found_exception'
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
  constructor(
    private casesRepository: CasesRepository,
    private clientsRepository: ClientsRepository,
    private usersRepository: UsersRepository
  ) {}

  /**
   * Create a new case
   *
   * @param payload - Case creation payload from validator
   * @returns Created case instance
   */
  async run(payload: ICase.CreatePayload): Promise<Case> {
    // Validate client exists
    const client = await this.clientsRepository.find(payload.client_id)
    if (!client) {
      throw new NotFoundException('Client not found')
    }

    // Validate responsible lawyer exists
    const lawyer = await this.usersRepository.find(payload.responsible_lawyer_id)
    if (!lawyer) {
      throw new NotFoundException('Responsible lawyer not found')
    }

    // Convert Date fields to DateTime if they exist
    const data: any = { ...payload }

    if (payload.filed_at) {
      data.filed_at = DateTime.fromJSDate(new Date(payload.filed_at))
    }

    // Set default status if not provided
    if (!data.status) {
      data.status = 'active'
    }

    return this.casesRepository.create(data)
  }
}
