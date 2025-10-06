import { inject } from '@adonisjs/core'
import CasesRepository from '#repositories/cases_repository'
import Case from '#models/case'

/**
 * Options for loading case relationships
 */
export interface GetCaseOptions {
  withClient?: boolean
  withDeadlines?: boolean
  withDocuments?: boolean
}

/**
 * Service for retrieving a case by ID with optional relationships
 *
 * @class GetCaseService
 * @example
 * const service = await app.container.make(GetCaseService)
 * const case = await service.run(caseId, { withClient: true })
 */
@inject()
export default class GetCaseService {
  constructor(private casesRepository: CasesRepository) {}

  /**
   * Get a case by ID with optional relationships
   *
   * @param caseId - The case ID to retrieve
   * @param options - Options for loading relationships
   * @returns Case instance or null if not found
   */
  async run(caseId: number, options: GetCaseOptions = {}): Promise<Case | null> {
    const caseInstance = await this.casesRepository.findBy('id', caseId)

    if (!caseInstance) {
      return null
    }

    // Load relationships if requested
    if (options.withClient) {
      await (caseInstance as any).load('client')
    }

    if (options.withDeadlines) {
      await (caseInstance as any).load('deadlines')
    }

    if (options.withDocuments) {
      await (caseInstance as any).load('documents')
    }

    return caseInstance
  }
}
