import { inject } from '@adonisjs/core'
import PerplexityClientService from '#services/perplexity/perplexity_client_service'
import PerplexitySearchesRepository from '#repositories/perplexity_searches_repository'
import IPerplexity from '#interfaces/perplexity_interface'
import logger from '@adonisjs/core/services/logger'
import TenantContextService from '#services/tenants/tenant_context_service'

/**
 * Legal Research Service
 *
 * Specialized service for jurisprudential research (pesquisa jurisprudencial)
 * Uses Perplexity AI with academic mode and Brazilian legal domain filtering
 *
 * @class LegalResearchService
 * @example
 * const service = await app.container.make(LegalResearchService)
 * const result = await service.search({
 *   topic: 'prisão preventiva descabimento',
 *   court: 'STF',
 *   recency: 'year'
 * })
 */
@inject()
export default class LegalResearchService {
  constructor(
    private perplexityClient: PerplexityClientService,
    private searchesRepository: PerplexitySearchesRepository
  ) {}

  /**
   * Perform legal research (jurisprudência)
   *
   * @param request - Legal research request
   * @returns Service response with AI analysis and sources
   */
  async search(
    request: Omit<IPerplexity.LegalResearchRequest, 'query' | 'search_type'>
  ): Promise<IPerplexity.ServiceResponse> {
    const query = this.buildQuery(request)
    const domainFilters = request.domain_filters || this.getDefaultDomainFilters(request.court)

    logger.info('Legal research request', {
      topic: request.topic,
      court: request.court,
      has_year_range: !!request.year_range,
    })

    try {
      // Call Perplexity with academic mode and domain filtering
      const response = await this.perplexityClient.searchWithDomainFilter(
        {
          query,
          search_type: 'legal_research',
          search_mode: 'academic',
          model: request.model,
          max_tokens: request.max_tokens,
          temperature: request.temperature || 0.2,
          case_id: request.case_id,
        },
        domainFilters
      )

      // Save search to database
      const tenantContext = await TenantContextService.getContext()
      if (!tenantContext) {
        throw new Error('Tenant context is required')
      }

      const search = await this.searchesRepository.create({
        user_id: tenantContext.user_id!,
        query,
        response: response.content,
        search_type: 'legal_research',
        model: response.model,
        search_mode: 'academic',
        tokens_used: response.usage?.total_tokens || null,
        prompt_tokens: response.usage?.prompt_tokens || null,
        completion_tokens: response.usage?.completion_tokens || null,
        metadata: {
          topic: request.topic,
          court: request.court,
          year_range: request.year_range,
          recency: request.recency,
          domain_filters: domainFilters,
          related_questions: response.related_questions,
        },
        search_results: response.search_results || null,
        case_id: request.case_id || null,
      })

      logger.info('Legal research completed', {
        search_id: search.id,
        sources_count: response.search_results?.length || 0,
        tokens_used: response.usage?.total_tokens,
      })

      return {
        search,
        response: response.content,
        sources: response.search_results,
        related_questions: response.related_questions,
        cached: false,
      }
    } catch (error) {
      logger.error('Legal research failed', {
        error: error.message,
        topic: request.topic,
      })
      throw error
    }
  }

  /**
   * Build optimized query for legal research
   */
  private buildQuery(
    request: Omit<IPerplexity.LegalResearchRequest, 'query' | 'search_type'>
  ): string {
    let query = `Pesquisa jurisprudencial sobre: ${request.topic}`

    if (request.court) {
      query += `\nTribunal: ${request.court}`
    }

    if (request.year_range) {
      if (request.year_range.from && request.year_range.to) {
        query += `\nPeríodo: ${request.year_range.from} a ${request.year_range.to}`
      } else if (request.year_range.from) {
        query += `\nA partir de: ${request.year_range.from}`
      } else if (request.year_range.to) {
        query += `\nAté: ${request.year_range.to}`
      }
    }

    query += `\n\nPor favor, forneça:\n`
    query += `1. Ementas e súmulas relevantes\n`
    query += `2. Teses jurídicas predominantes\n`
    query += `3. Precedentes importantes\n`
    query += `4. Divergências jurisprudenciais (se houver)\n`
    query += `\nCite sempre a fonte, tribunal, data e número do processo.`

    return query
  }

  /**
   * Get default domain filters based on court
   */
  private getDefaultDomainFilters(court?: string): IPerplexity.LegalDomainFilters {
    const filters: IPerplexity.LegalDomainFilters = {
      includeBrazilianLegalDomains: true,
    }

    if (court) {
      // Map common court names to domains
      const courtDomainMap: Record<string, string[]> = {
        'STF': ['stf.jus.br'],
        'STJ': ['stj.jus.br'],
        'TST': ['tst.jus.br'],
        'TJ-SP': ['tjsp.jus.br'],
        'TJSP': ['tjsp.jus.br'],
        'TJ-RJ': ['tjrj.jus.br'],
        'TJRJ': ['tjrj.jus.br'],
        'TJ-MG': ['tjmg.jus.br'],
        'TJMG': ['tjmg.jus.br'],
        'TJ-RS': ['tjrs.jus.br'],
        'TJRS': ['tjrs.jus.br'],
        'TRF-1': ['trf1.jus.br'],
        'TRF1': ['trf1.jus.br'],
        'TRF-2': ['trf2.jus.br'],
        'TRF2': ['trf2.jus.br'],
        'TRF-3': ['trf3.jus.br'],
        'TRF3': ['trf3.jus.br'],
        'TRF-4': ['trf4.jus.br'],
        'TRF4': ['trf4.jus.br'],
        'TRF-5': ['trf5.jus.br'],
        'TRF5': ['trf5.jus.br'],
        'TRF-6': ['trf6.jus.br'],
        'TRF6': ['trf6.jus.br'],
      }

      const courtKey = court.toUpperCase().replace(/\s+/g, '')
      if (courtDomainMap[courtKey]) {
        filters.courts = courtDomainMap[courtKey]
      }
    }

    return filters
  }
}
