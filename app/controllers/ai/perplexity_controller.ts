import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import LegalResearchService from '#services/perplexity/legal_research_service'
import LegislationSearchService from '#services/perplexity/legislation_search_service'
import CaseAnalysisService from '#services/perplexity/case_analysis_service'
import LegalWritingAssistantService from '#services/perplexity/legal_writing_assistant_service'
import PerplexitySearchesRepository from '#repositories/perplexity_searches_repository'
import PerplexitySearch from '#models/perplexity_search'
import {
  legalResearchValidator,
  legislationSearchValidator,
  caseAnalysisValidator,
  legalWritingValidator,
  searchHistoryValidator,
} from '#validators/perplexity'

/**
 * Perplexity AI Controller
 *
 * Exposes AI-powered legal research and writing assistance endpoints
 *
 * @class PerplexityController
 */
@inject()
export default class PerplexityController {
  constructor(
    private legalResearchService: LegalResearchService,
    private legislationService: LegislationSearchService,
    private caseAnalysisService: CaseAnalysisService,
    private legalWritingService: LegalWritingAssistantService,
    private searchesRepository: PerplexitySearchesRepository
  ) {}

  /**
   * POST /api/v1/ai/legal-research
   * Perform jurisprudential research
   */
  async legalResearch({ request, response }: HttpContext) {
    const payload = await legalResearchValidator.validate(request.all())

    const result = await this.legalResearchService.search(payload)

    return response.json({
      id: result.search.id,
      response: result.response,
      sources: result.sources,
      related_questions: result.related_questions,
      metadata: {
        model: result.search.model,
        tokens_used: result.search.tokens_used,
        search_type: result.search.search_type,
        cached: result.cached,
      },
    })
  }

  /**
   * POST /api/v1/ai/legislation
   * Search Brazilian legislation
   */
  async legislation({ request, response }: HttpContext) {
    const payload = await legislationSearchValidator.validate(request.all())

    const result = await this.legislationService.search(payload)

    return response.json({
      id: result.search.id,
      response: result.response,
      sources: result.sources,
      related_questions: result.related_questions,
      metadata: {
        model: result.search.model,
        tokens_used: result.search.tokens_used,
        search_type: result.search.search_type,
        cached: result.cached,
      },
    })
  }

  /**
   * POST /api/v1/ai/case-analysis
   * Analyze a legal case
   */
  async caseAnalysis({ request, response }: HttpContext) {
    const payload = await caseAnalysisValidator.validate(request.all())

    const result = await this.caseAnalysisService.analyze(payload)

    return response.json({
      id: result.search.id,
      response: result.response,
      sources: result.sources,
      related_questions: result.related_questions,
      metadata: {
        model: result.search.model,
        tokens_used: result.search.tokens_used,
        search_type: result.search.search_type,
        cached: result.cached,
      },
    })
  }

  /**
   * POST /api/v1/ai/writing-assistant
   * Get legal writing assistance
   */
  async writingAssistant({ request, response }: HttpContext) {
    const payload = await legalWritingValidator.validate(request.all())

    const result = await this.legalWritingService.assist(payload)

    return response.json({
      id: result.search.id,
      response: result.response,
      sources: result.sources,
      related_questions: result.related_questions,
      metadata: {
        model: result.search.model,
        tokens_used: result.search.tokens_used,
        search_type: result.search.search_type,
        cached: result.cached,
      },
    })
  }

  /**
   * GET /api/v1/ai/search-history
   * Get search history with pagination and filters
   */
  async searchHistory({ request, response }: HttpContext) {
    const payload = await searchHistoryValidator.validate(request.qs())

    const page = payload.page || 1
    const perPage = payload.per_page || 20

    let query = PerplexitySearch.query().orderBy('created_at', 'desc')

    // Apply filters
    if (payload.search_type) {
      query = query.where('search_type', payload.search_type)
    }

    if (payload.case_id) {
      query = query.where('case_id', payload.case_id)
    }

    if (payload.search_term) {
      query = query.whereILike('query', `%${payload.search_term}%`)
    }

    if (payload.from_date) {
      query = query.where('created_at', '>=', payload.from_date.toISOString())
    }

    if (payload.to_date) {
      query = query.where('created_at', '<=', payload.to_date.toISOString())
    }

    const searches = await query.paginate(page, perPage)

    return response.json(searches)
  }

  /**
   * GET /api/v1/ai/search-history/:id
   * Get a specific search by ID
   */
  async getSearch({ params, response }: HttpContext) {
    const searchId = +params.id

    const search = await this.searchesRepository.findBy('id', searchId)

    if (!search) {
      return response.notFound({ message: 'Search not found' })
    }

    return response.json(search)
  }

  /**
   * GET /api/v1/ai/stats
   * Get usage statistics
   */
  async stats({ request, response }: HttpContext) {
    const days = request.input('days', 30)

    const totalTokens = await this.searchesRepository.getTotalTokensForTenant(days)
    const countByType = await this.searchesRepository.getCountByType(days)

    const recentSearches = await PerplexitySearch.query()
      .withScopes((scopes) =>
        scopes.recent(days)
      )
      .count('* as count')
      .first()

    const totalSearches = Number(recentSearches?.$extras?.count || 0)

    return response.json({
      period_days: days,
      total_searches: totalSearches,
      total_tokens_used: totalTokens,
      searches_by_type: countByType,
      average_tokens_per_search: totalSearches > 0 ? Math.round(totalTokens / totalSearches) : 0,
    })
  }

  /**
   * DELETE /api/v1/ai/search-history/:id
   * Delete a search from history
   */
  async deleteSearch({ params, response }: HttpContext) {
    const searchId = +params.id

    const search = await this.searchesRepository.findBy('id', searchId)

    if (!search) {
      return response.notFound({ message: 'Search not found' })
    }

    await search.delete()

    return response.noContent()
  }
}
