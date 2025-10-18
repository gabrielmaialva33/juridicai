import { inject } from '@adonisjs/core'
import PerplexityClientService from '#services/perplexity/perplexity_client_service'
import PerplexitySearchesRepository from '#repositories/perplexity_searches_repository'
import IPerplexity from '#interfaces/perplexity_interface'
import logger from '@adonisjs/core/services/logger'
import TenantContextService from '#services/tenants/tenant_context_service'

/**
 * Legal Writing Assistant Service
 *
 * Specialized service for assisting in legal document drafting
 * Provides structure, arguments, and legal references for Brazilian legal documents
 *
 * @class LegalWritingAssistantService
 * @example
 * const service = await app.container.make(LegalWritingAssistantService)
 * const result = await service.assist({
 *   document_type: 'Petição Inicial',
 *   context: 'Ação de cobrança por serviços não pagos',
 *   style: 'formal'
 * })
 */
@inject()
export default class LegalWritingAssistantService {
  constructor(
    private perplexityClient: PerplexityClientService,
    private searchesRepository: PerplexitySearchesRepository
  ) {}

  /**
   * Assist with legal document writing
   *
   * @param request - Legal writing request
   * @returns Service response with writing guidance
   */
  async assist(
    request: Omit<IPerplexity.LegalWritingRequest, 'query' | 'search_type'>
  ): Promise<IPerplexity.ServiceResponse> {
    const query = this.buildQuery(request)
    const domainFilters: IPerplexity.LegalDomainFilters = {
      includeBrazilianLegalDomains: true,
    }

    logger.info('Legal writing assistance request', {
      document_type: request.document_type,
      style: request.style,
    })

    try {
      const response = await this.perplexityClient.searchWithDomainFilter(
        {
          query,
          search_type: 'legal_writing',
          search_mode: 'academic',
          model: request.model,
          max_tokens: request.max_tokens || 6000,
          temperature: request.temperature || 0.4, // Slightly higher for creative writing
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
        search_type: 'legal_writing',
        model: response.model,
        search_mode: 'academic',
        tokens_used: response.usage?.total_tokens || null,
        prompt_tokens: response.usage?.prompt_tokens || null,
        completion_tokens: response.usage?.completion_tokens || null,
        metadata: {
          document_type: request.document_type,
          style: request.style,
          domain_filters: domainFilters,
          related_questions: response.related_questions,
        },
        search_results: response.search_results || null,
        case_id: request.case_id || null,
      })

      logger.info('Legal writing assistance completed', {
        search_id: search.id,
        document_type: request.document_type,
      })

      return {
        search,
        response: response.content,
        sources: response.search_results,
        related_questions: response.related_questions,
        cached: false,
      }
    } catch (error) {
      logger.error('Legal writing assistance failed', {
        error: error.message,
        document_type: request.document_type,
      })
      throw error
    }
  }

  /**
   * Build optimized query for legal writing assistance
   */
  private buildQuery(
    request: Omit<IPerplexity.LegalWritingRequest, 'query' | 'search_type'>
  ): string {
    const styleMap = {
      formal: 'linguagem formal e técnica',
      concise: 'linguagem objetiva e concisa',
      detailed: 'linguagem detalhada e fundamentada',
    }

    const styleDesc = styleMap[request.style || 'formal']

    let query = `Assistência para elaboração de: ${request.document_type}\n\n`
    query += `Contexto:\n${request.context}\n\n`
    query += `Estilo desejado: ${styleDesc}\n\n`
    query += `Por favor, forneça:\n`
    query += `1. Estrutura adequada do documento\n`
    query += `2. Argumentos jurídicos principais\n`
    query += `3. Fundamentação legal (legislação aplicável)\n`
    query += `4. Jurisprudência relevante para citação\n`
    query += `5. Teses defensivas ou estratégicas\n`
    query += `6. Pedidos/requerimentos apropriados\n\n`

    if (this.isProcessualDocument(request.document_type)) {
      query += `IMPORTANTE: Siga as normas do Código de Processo Civil brasileiro e a estrutura tradicional da peça processual.\n`
    }

    query += `\nCite as fontes legais e jurisprudenciais.`

    return query
  }

  /**
   * Check if document type is processual (requires CPC structure)
   */
  private isProcessualDocument(documentType: string): boolean {
    const processualTypes = [
      'petição inicial',
      'contestação',
      'réplica',
      'impugnação',
      'recurso',
      'apelação',
      'agravo',
      'embargos',
      'mandado de segurança',
    ]

    const normalized = documentType.toLowerCase().trim()
    return processualTypes.some((type) => normalized.includes(type))
  }
}
