import { inject } from '@adonisjs/core'
import NvidiaQuery from '#models/nvidia_query'
import LucidRepository from '#shared/lucid/lucid_repository'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

type QueryType =
  | 'document_analysis'
  | 'contract_review'
  | 'code_generation'
  | 'text_analysis'
  | 'general'

@inject()
export default class NvidiaQueriesRepository extends LucidRepository<typeof NvidiaQuery> {
  constructor() {
    super(NvidiaQuery)
  }

  /**
   * Find queries by user ID with pagination
   * @param userId - The user ID to filter by
   * @param page - Page number (1-based)
   * @param limit - Number of results per page
   * @returns Paginated results of user's queries
   */
  async findByUser(
    userId: number,
    page: number = 1,
    limit: number = 20
  ): Promise<ModelPaginatorContract<NvidiaQuery>> {
    return this.model
      .query()
      .withScopes((scopes) => {
        scopes.byUser(userId)
        scopes.newest()
      })
      .paginate(page, limit)
  }

  /**
   * Find queries by case ID
   * @param caseId - The case ID to filter by
   * @returns Array of queries associated with the case
   */
  async findByCase(caseId: number): Promise<NvidiaQuery[]> {
    return this.model.query().withScopes((scopes) => {
      scopes.byCase(caseId)
      scopes.newest()
    })
  }

  /**
   * Find queries by type with pagination
   * @param type - The query type to filter by
   * @param page - Page number (1-based)
   * @param limit - Number of results per page
   * @returns Paginated results of queries by type
   */
  async findByType(
    type: QueryType,
    page: number = 1,
    limit: number = 20
  ): Promise<ModelPaginatorContract<NvidiaQuery>> {
    return this.model
      .query()
      .withScopes((scopes) => {
        scopes.ofType(type)
        scopes.newest()
      })
      .paginate(page, limit)
  }

  /**
   * Search queries by text with pagination
   * @param searchTerm - Text to search in queries and responses
   * @param page - Page number (1-based)
   * @param limit - Number of results per page
   * @returns Paginated results of matching queries
   */
  async searchByText(
    searchTerm: string,
    page: number = 1,
    limit: number = 20
  ): Promise<ModelPaginatorContract<NvidiaQuery>> {
    return this.model
      .query()
      .withScopes((scopes) => {
        scopes.search(searchTerm)
        scopes.newest()
      })
      .paginate(page, limit)
  }

  /**
   * Get recent queries for a user
   * @param userId - The user ID to filter by
   * @param days - Number of days to look back
   * @returns Array of recent queries
   */
  async getRecentByUser(userId: number, days: number = 7): Promise<NvidiaQuery[]> {
    return this.model.query().withScopes((scopes) => {
      scopes.byUser(userId)
      scopes.recent(days)
      scopes.newest()
    })
  }

  /**
   * Get total tokens used by user within a period
   * @param userId - The user ID
   * @param days - Number of days to look back
   * @returns Total tokens used
   */
  async getTotalTokensByUser(userId: number, days: number = 30): Promise<number> {
    const result = await this.model
      .query()
      .withScopes((scopes) => {
        scopes.byUser(userId)
        scopes.recent(days)
      })
      .sum('tokens_used as total')
      .first()

    return Number(result?.$extras?.total || 0)
  }

  /**
   * Get total tokens used across tenant within a period
   * @param days - Number of days to look back
   * @returns Total tokens used
   */
  async getTotalTokensForTenant(days: number = 30): Promise<number> {
    const result = await this.model
      .query()
      .withScopes((scopes) => {
        scopes.recent(days)
      })
      .sum('tokens_used as total')
      .first()

    return Number(result?.$extras?.total || 0)
  }

  /**
   * Get query count by type within a period
   * @param days - Number of days to look back
   * @returns Object with count per query type
   */
  async getCountByType(days: number = 30): Promise<Record<QueryType, number>> {
    const results = await this.model
      .query()
      .withScopes((scopes) => {
        scopes.recent(days)
      })
      .groupBy('query_type')
      .select('query_type')
      .count('* as count')

    const counts: Record<string, number> = {}
    for (const result of results) {
      counts[result.query_type] = Number(result.$extras?.count || 0)
    }

    return counts as Record<QueryType, number>
  }
}
