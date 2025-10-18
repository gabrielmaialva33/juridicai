import { inject } from '@adonisjs/core'
import PerplexityClientService from '#services/perplexity/perplexity_client_service'
import PerplexitySearchesRepository from '#repositories/perplexity_searches_repository'
import IPerplexity from '#interfaces/perplexity_interface'
import logger from '@adonisjs/core/services/logger'
import TenantContextService from '#services/tenants/tenant_context_service'

/**
 * Legislation Search Service
 *
 * Specialized service for Brazilian legislation research
 * Focuses on laws, decrees, resolutions, and regulations
 *
 * @class LegislationSearchService
 * @example
 * const service = await app.container.make(LegislationSearchService)
 * const result = await service.search({
 *   topic: 'LGPD tratamento de dados pessoais',
 *   legislation_type: 'lei',
 *   recency: 'year'
 * })
 */
@inject()
export default class LegislationSearchService {
  constructor(
    private perplexityClient: PerplexityClientService,
    private searchesRepository: PerplexitySearchesRepository
  ) {}

  /**
   * Search for Brazilian legislation
   *
   * @param request - Legislation search request
   * @returns Service response with legislation info and sources
   */
  async search(
    request: Omit<IPerplexity.LegislationSearchRequest, 'query' | 'search_type'>
  ): Promise<IPerplexity.ServiceResponse> {
    const query = this.buildQuery(request)
    const domainFilters: IPerplexity.LegalDomainFilters = {
      legislationOnly: true,
      includeBrazilianLegalDomains: true,
    }

    logger.info('Legislation search request', {
      topic: request.topic,
      type: request.legislation_type,
    })

    try {
      const response = await this.perplexityClient.searchWithDomainFilter(
        {
          query,
          search_type: 'legislation',
          search_mode: 'web',
          model: request.model,
          max_tokens: request.max_tokens,
          temperature: request.temperature || 0.1, // Lower temperature for factual accuracy
          case_id: request.case_id,
        },
        domainFilters
      )

      const tenantContext = await TenantContextService.getContext()
      if (!tenantContext) {
        throw new Error('Tenant context is required')
      }

      const search = await this.searchesRepository.create({
        user_id: tenantContext.user_id!,
        query,
        response: response.content,
        search_type: 'legislation',
        model: response.model,
        search_mode: 'web',
        tokens_used: response.usage?.total_tokens || null,
        prompt_tokens: response.usage?.prompt_tokens || null,
        completion_tokens: response.usage?.completion_tokens || null,
        metadata: {
          topic: request.topic,
          legislation_type: request.legislation_type,
          recency: request.recency,
          domain_filters: domainFilters,
          related_questions: response.related_questions,
        },
        search_results: response.search_results || null,
        case_id: request.case_id || null,
      })

      logger.info('Legislation search completed', {
        search_id: search.id,
        sources_count: response.search_results?.length || 0,
      })

      return {
        search,
        response: response.content,
        sources: response.search_results,
        related_questions: response.related_questions,
        cached: false,
      }
    } catch (error) {
      logger.error('Legislation search failed', {
        error: error.message,
        topic: request.topic,
      })
      throw error
    }
  }

  /**
   * Build optimized query for legislation search
   */
  private buildQuery(
    request: Omit<IPerplexity.LegislationSearchRequest, 'query' | 'search_type'>
  ): string {
    let query = `Pesquisa de legislação brasileira sobre: ${request.topic}`

    if (request.legislation_type) {
      query += `\nTipo: ${request.legislation_type}`
    }

    query += `\n\nPor favor, forneça:\n`
    query += `1. Texto legal aplicável (artigos específicos)\n`
    query += `2. Número e data da norma\n`
    query += `3. Alterações e atualizações recentes\n`
    query += `4. Regulamentação relacionada\n`
    query += `5. Aplicação prática\n`
    query += `\nSempre cite a fonte oficial (Diário Oficial, Planalto.gov.br, etc).`

    return query
  }
}
