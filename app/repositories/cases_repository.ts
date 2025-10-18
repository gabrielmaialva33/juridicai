import { inject } from '@adonisjs/core'
import Case from '#models/case'
import ICase from '#interfaces/case_interface'
import LucidRepository from '#shared/lucid/lucid_repository'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import { PaginateOptions, PaginateResult } from '#shared/lucid/lucid_repository_interface'

@inject()
export default class CasesRepository
  extends LucidRepository<typeof Case>
  implements ICase.Repository
{
  constructor() {
    super(Case)
  }

  /**
   * Override paginate to fix Lucid ORM bug where COUNT query doesn't respect withScopes()
   * This ensures accurate total counts when using model scopes for filtering
   */
  async paginate(options: PaginateOptions<typeof Case>): Promise<PaginateResult<typeof Case>> {
    const query = this.buildQuery({ opts: options })

    query.orderBy(options.sortBy || this.DEFAULT_SORT, options.direction || this.DEFAULT_DIRECTION)

    // Manual pagination to avoid Lucid's paginate() COUNT bug with scopes
    const page = options.page || this.DEFAULT_PAGE
    const perPage = options.perPage || this.DEFAULT_PER_PAGE

    // Get total count using a cloned query with all scopes applied
    const countQuery = query.clone().clearSelect().clearOrder()
    const totalResult = await countQuery.count('* as total').first()
    const total = Number(totalResult?.$extras?.total || 0)

    // Get paginated data
    const data = await query.offset((page - 1) * perPage).limit(perPage)

    // Build paginator response matching Lucid's ModelPaginatorContract format
    return {
      data,
      meta: {
        total,
        per_page: perPage,
        current_page: page,
        last_page: Math.ceil(total / perPage),
        first_page: 1,
        first_page_url: '',
        last_page_url: '',
        next_page_url: page < Math.ceil(total / perPage) ? '' : null,
        previous_page_url: page > 1 ? '' : null,
      },
    }
  }

  /**
   * Find a case by case number
   * @param caseNumber - The case number to search for
   * @returns The case if found, null otherwise
   */
  async findByCaseNumber(caseNumber: string): Promise<Case | null> {
    return this.model.query().where('case_number', caseNumber).first()
  }

  /**
   * Find cases for a specific client
   * @param clientId - The client ID to filter by
   * @returns Array of cases for the client
   */
  async findByClient(clientId: number): Promise<Case[]> {
    return this.model.query().withScopes((scopes) => {
      scopes.forClient(clientId)
      scopes.active()
      scopes.newest()
    })
  }

  /**
   * Find urgent/high priority cases
   * @returns Array of urgent cases
   */
  async findUrgent(): Promise<Case[]> {
    return this.model
      .query()
      .withScopes((scopes) => {
        scopes.urgent()
        scopes.active()
        scopes.withDeadlinesCount()
        scopes.byPriorityOrder()
      })
      .preload('client')
      .preload('responsible_lawyer')
  }

  /**
   * Find cases with upcoming deadlines
   * @param days - Number of days to look ahead for deadlines
   * @returns Array of cases with upcoming deadlines
   */
  async findWithUpcomingDeadlines(days: number): Promise<Case[]> {
    return this.model
      .query()
      .withScopes((scopes) => {
        scopes.withUpcomingDeadlines(days)
        scopes.active()
        scopes.byPriorityOrder()
      })
      .preload('client')
      .preload('responsible_lawyer')
  }

  /**
   * Find cases assigned to a specific lawyer
   * @param lawyerId - The lawyer/user ID to filter by
   * @returns Array of cases assigned to the lawyer
   */
  async findByResponsible(lawyerId: number): Promise<Case[]> {
    return this.model.query().withScopes((scopes) => {
      scopes.assignedTo(lawyerId)
      scopes.active()
      scopes.newest()
    })
  }

  /**
   * Search cases with pagination
   * @param search - Search term to match against case number, description
   * @param page - Page number (1-based)
   * @param limit - Number of results per page
   * @returns Paginated results of matching cases
   */
  async searchCases(
    search: string,
    page: number,
    limit: number
  ): Promise<ModelPaginatorContract<Case>> {
    return this.model
      .query()
      .withScopes((scopes) => {
        scopes.search(search)
        scopes.withDeadlinesCount()
        scopes.withDocumentsCount()
        scopes.newest()
      })
      .preload('client')
      .preload('responsible_lawyer')
      .paginate(page, limit)
  }

  /**
   * Get case statistics
   * @returns Object with various case statistics
   */
  async getCaseStatistics(): Promise<{
    total: number
    byStatus: Record<string, number>
    byPriority: Record<string, number>
    byType: Record<string, number>
  }> {
    const cases = await this.model.query().select('status', 'priority', 'case_type')

    const byStatus: Record<string, number> = {}
    const byPriority: Record<string, number> = {}
    const byType: Record<string, number> = {}

    cases.forEach((c) => {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1
      byPriority[c.priority] = (byPriority[c.priority] || 0) + 1
      byType[c.case_type] = (byType[c.case_type] || 0) + 1
    })

    return {
      total: cases.length,
      byStatus,
      byPriority,
      byType,
    }
  }

  /**
   * Find cases requiring immediate attention
   * @returns Array of cases requiring attention
   */
  async findRequiringAttention(): Promise<Case[]> {
    return this.model
      .query()
      .withScopes((scopes) => {
        scopes.requiresAttention()
        scopes.active()
        scopes.withDeadlinesCount()
        scopes.byPriorityOrder()
      })
      .preload('client')
      .preload('responsible_lawyer')
  }
}
