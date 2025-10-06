import { inject } from '@adonisjs/core'
import CasesRepository from '#repositories/cases_repository'

/**
 * Service for soft-deleting a case (archiving)
 *
 * @class DeleteCaseService
 * @example
 * const service = await app.container.make(DeleteCaseService)
 * await service.run(caseId)
 */
@inject()
export default class DeleteCaseService {
  constructor(private casesRepository: CasesRepository) {}

  /**
   * Soft delete a case by setting status to 'archived'
   *
   * @param caseId - The case ID to delete (archive)
   * @returns void
   * @throws Error if case not found
   */
  async run(caseId: number): Promise<void> {
    const caseInstance = await this.casesRepository.findBy('id', caseId)

    if (!caseInstance) {
      throw new Error('Case not found')
    }

    // Soft delete: set status to archived
    caseInstance.status = 'archived'
    await caseInstance.save()
  }
}
