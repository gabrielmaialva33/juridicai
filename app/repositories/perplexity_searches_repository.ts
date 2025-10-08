import { inject } from '@adonisjs/core'
import PerplexitySearch from '#models/perplexity_search'
import LucidRepository from '#shared/lucid/lucid_repository'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

type SearchType = 'legal_research' | 'legislation' | 'case_analysis' | 'legal_writing' | 'general'

@inject()
export default class PerplexitySearchesRepository extends LucidRepository<
  typeof PerplexitySearch
> {
  constructor() {
    super(PerplexitySearch)
  }

  /**
   * Find searches by user ID with pagination
   * @param userId - The user ID to filter by
   * @param page - Page number (1-based)
   * @param limit - Number of results per page
   * @returns Paginated results of user's searches
   */
  async findByUser(
    userId: number,
    page: number = 1,
    limit: number = 20
  ): Promise<ModelPaginatorContract<PerplexitySearch>> {
    return this.model
      .query()
      .withScopes((scopes) => {
        scopes.byUser(userId)
        scopes.newest()
      })
      .paginate(page, limit)
  }

  /**
   * Find searches by case ID
   * @param caseId - The case ID to filter by
   * @returns Array of searches associated with the case
   */
  async findByCase(caseId: number): Promise<PerplexitySearch[]> {
    return this.model.query().withScopes((scopes) => {
      scopes.byCase(caseId)
      scopes.newest()
    })
  }

  /**
   * Find searches by type with pagination
   * @param type - The search type to filter by
   * @param page - Page number (1-based)
   * @param limit - Number of results per page
   * @returns Paginated results of searches by type
   */
  async findByType(
    type: SearchType,
    page: number = 1,
    limit: number = 20
  ): Promise<ModelPaginatorContract<PerplexitySearch>> {
    return this.model
      .query()
      .withScopes((scopes) => {
        scopes.ofType(type)
        scopes.newest()
      })
      .paginate(page, limit)
  }

  /**
   * Search searches by query text with pagination
   * @param searchTerm - Text to search in queries and responses
   * @param page - Page number (1-based)
   * @param limit - Number of results per page
   * @returns Paginated results of matching searches
   */
  async searchByText(
    searchTerm: string,
    page: number = 1,
    limit: number = 20
  ): Promise<ModelPaginatorContract<PerplexitySearch>> {
    return this.model
      .query()
      .withScopes((scopes) => {
        scopes.search(searchTerm)
        scopes.newest()
      })
      .paginate(page, limit)
  }

  /**
   * Get recent searches for a user
   * @param userId - The user ID to filter by
   * @param days - Number of days to look back
   * @returns Array of recent searches
   */
  async getRecentByUser(userId: number, days: number = 7): Promise<PerplexitySearch[]> {
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
   * Get search count by type within a period
   * @param days - Number of days to look back
   * @returns Object with count per search type
   */
  async getCountByType(days: number = 30): Promise<Record<SearchType, number>> {
    const results = await this.model
      .query()
      .withScopes((scopes) => {
        scopes.recent(days)
      })
      .groupBy('search_type')
      .select('search_type')
      .count('* as count')

    const counts: Record<string, number> = {}
    for (const result of results) {
      counts[result.search_type] = Number(result.$extras?.count || 0)
    }

    return counts as Record<SearchType, number>
  }

  /**
   * Find searches with similar queries (for cache lookup)
   * @param query - The query to match
   * @param searchType - The search type to filter by
   * @param maxAge - Maximum age in hours for cache validity
   * @returns Most recent matching search or null
   */
  async findSimilarQuery(
    query: string,
    searchType: SearchType,
    maxAge: number = 24
  ): Promise<PerplexitySearch | null> {
    const cutoffDate = new Date(Date.now() - maxAge * 60 * 60 * 1000)

    return this.model
      .query()
      .where('query', query)
      .where('search_type', searchType)
      .where('created_at', '>', cutoffDate.toISOString())
      .orderBy('created_at', 'desc')
      .first()
  }
}
