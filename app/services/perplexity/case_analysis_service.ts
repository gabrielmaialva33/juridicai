import { inject } from '@adonisjs/core'
import PerplexityClientService from '#services/perplexity/perplexity_client_service'
import PerplexitySearchesRepository from '#repositories/perplexity_searches_repository'
import IPerplexity from '#interfaces/perplexity_interface'
import logger from '@adonisjs/core/services/logger'
import TenantContextService from '#services/tenants/tenant_context_service'

/**
 * Case Analysis Service
 *
 * Specialized service for analyzing legal cases
 * Provides strategic insights, similar cases, and risk assessment
 *
 * @class CaseAnalysisService
 * @example
 * const service = await app.container.make(CaseAnalysisService)
 * const result = await service.analyze({
 *   case_summary: 'Ação trabalhista por assédio moral...',
 *   legal_area: 'Direito do Trabalho',
 *   questions: ['Qual a probabilidade de êxito?', 'Quais os principais riscos?']
 * })
 */
@inject()
export default class CaseAnalysisService {
  constructor(
    private perplexityClient: PerplexityClientService,
    private searchesRepository: PerplexitySearchesRepository
  ) {}

  /**
   * Analyze a legal case
   *
   * @param request - Case analysis request
   * @returns Service response with strategic analysis
   */
  async analyze(
    request: Omit<IPerplexity.CaseAnalysisRequest, 'query' | 'search_type'>
  ): Promise<IPerplexity.ServiceResponse> {
    const query = this.buildQuery(request)
    const domainFilters: IPerplexity.LegalDomainFilters = {
      includeBrazilianLegalDomains: true,
    }

    logger.info('Case analysis request', {
      legal_area: request.legal_area,
      has_questions: !!request.questions && request.questions.length > 0,
      case_id: request.case_id,
    })

    try {
      const response = await this.perplexityClient.searchWithDomainFilter(
        {
          query,
          search_type: 'case_analysis',
          search_mode: 'academic',
          model: request.model,
          max_tokens: request.max_tokens || 6000, // Higher limit for detailed analysis
          temperature: request.temperature || 0.3,
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
        search_type: 'case_analysis',
        model: response.model,
        search_mode: 'academic',
        tokens_used: response.usage?.total_tokens || null,
        prompt_tokens: response.usage?.prompt_tokens || null,
        completion_tokens: response.usage?.completion_tokens || null,
        metadata: {
          case_summary: this.anonymizeSummary(request.case_summary),
          legal_area: request.legal_area,
          questions: request.questions,
          domain_filters: domainFilters,
          related_questions: response.related_questions,
        },
        search_results: response.search_results || null,
        case_id: request.case_id || null,
      })

      logger.info('Case analysis completed', {
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
      logger.error('Case analysis failed', {
        error: error.message,
        legal_area: request.legal_area,
      })
      throw error
    }
  }

  /**
   * Build optimized query for case analysis
   */
  private buildQuery(
    request: Omit<IPerplexity.CaseAnalysisRequest, 'query' | 'search_type'>
  ): string {
    let query = `Análise estratégica de caso jurídico:\n\n`
    query += `Resumo do caso:\n${this.anonymizeSummary(request.case_summary)}\n\n`

    if (request.legal_area) {
      query += `Área do direito: ${request.legal_area}\n\n`
    }

    query += `Por favor, forneça:\n`
    query += `1. Análise de viabilidade jurídica\n`
    query += `2. Precedentes similares (casos análogos)\n`
    query += `3. Avaliação de riscos e probabilidades\n`
    query += `4. Estratégias processuais recomendadas\n`
    query += `5. Argumentos favoráveis e desfavoráveis\n`
    query += `6. Teses jurídicas aplicáveis\n\n`

    if (request.questions && request.questions.length > 0) {
      query += `Questões específicas:\n`
      request.questions.forEach((q, i) => {
        query += `${i + 1}. ${q}\n`
      })
    }

    query += `\nBase sua análise em jurisprudência consolidada e cite as fontes.`

    return query
  }

  /**
   * Anonymize sensitive information from case summary
   * IMPORTANT: Remove personal data before sending to Perplexity (LGPD compliance)
   */
  private anonymizeSummary(summary: string): string {
    let anonymized = summary

    // Remove CPF patterns (###.###.###-##)
    anonymized = anonymized.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '[CPF REMOVIDO]')

    // Remove CNPJ patterns (##.###.###/####-##)
    anonymized = anonymized.replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, '[CNPJ REMOVIDO]')

    // Remove email addresses
    anonymized = anonymized.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL REMOVIDO]')

    // Remove phone numbers (various Brazilian formats)
    anonymized = anonymized.replace(/\(?\d{2}\)?\s?\d{4,5}-?\d{4}/g, '[TELEFONE REMOVIDO]')

    return anonymized
  }
}
