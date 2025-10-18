import { inject } from '@adonisjs/core'
import env from '#start/env'
import Perplexity from '@perplexity-ai/perplexity_ai'
import IPerplexity from '#interfaces/perplexity_interface'
import logger from '@adonisjs/core/services/logger'

/**
 * Perplexity Client Service
 *
 * Base service for interacting with Perplexity AI API
 * Handles authentication, request formatting, and error handling
 *
 * @class PerplexityClientService
 * @example
 * const client = await app.container.make(PerplexityClientService)
 * const response = await client.chat({ query: '...', search_type: 'legal_research' })
 */
@inject()
export default class PerplexityClientService {
  private client: Perplexity

  constructor() {
    const apiKey = env.get('PERPLEXITY_API_KEY')

    if (!apiKey || apiKey === 'your-perplexity-api-key') {
      throw new Error('PERPLEXITY_API_KEY not configured. Please set it in your .env file.')
    }

    this.client = new Perplexity({
      apiKey,
    })
  }

  /**
   * Execute a chat completion request with Perplexity
   *
   * @param request - Search request configuration
   * @returns Perplexity API response with content and sources
   */
  async chat(request: IPerplexity.BaseRequest): Promise<IPerplexity.PerplexityResponse> {
    try {
      const model = request.model || env.get('PERPLEXITY_DEFAULT_MODEL', 'sonar-pro')
      const maxTokens = request.max_tokens || env.get('PERPLEXITY_MAX_TOKENS', 4000)
      const temperature = request.temperature ?? env.get('PERPLEXITY_TEMPERATURE', 0.2)

      logger.info('Perplexity API request', {
        search_type: request.search_type,
        model,
        query_length: request.query.length,
      })

      const response = await this.client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(request.search_type),
          },
          {
            role: 'user',
            content: request.query,
          },
        ],
        max_tokens: maxTokens,
        temperature,
        search_mode: request.search_mode,
        return_related_questions: true,
        return_images: false,
      } as any)

      const choice = response.choices[0]
      const messageContent = choice?.message?.content
      const content =
        typeof messageContent === 'string'
          ? messageContent
          : Array.isArray(messageContent)
            ? messageContent.map((chunk: any) => chunk.text || '').join('')
            : ''

      logger.info('Perplexity API response received', {
        search_type: request.search_type,
        tokens_used: response.usage?.total_tokens,
        has_sources: !!response.search_results,
      })

      return {
        content,
        search_results: this.formatSearchResults(response.search_results as any),
        related_questions: (response as any).related_questions || [],
        usage: response.usage
          ? {
              prompt_tokens: response.usage.prompt_tokens,
              completion_tokens: response.usage.completion_tokens,
              total_tokens: response.usage.total_tokens,
            }
          : undefined,
        model: response.model,
      }
    } catch (error) {
      logger.error('Perplexity API error', {
        error: error.message,
        search_type: request.search_type,
      })

      throw new Error(`Perplexity API request failed: ${error.message}`)
    }
  }

  /**
   * Execute a search with custom domain filtering
   *
   * @param request - Search request
   * @param domainFilters - Domain filter configuration
   * @returns Perplexity API response
   */
  async searchWithDomainFilter(
    request: IPerplexity.BaseRequest,
    domainFilters: IPerplexity.LegalDomainFilters
  ): Promise<IPerplexity.PerplexityResponse> {
    const domains = this.buildDomainList(domainFilters)

    const model = request.model || env.get('PERPLEXITY_DEFAULT_MODEL', 'sonar-pro')
    const maxTokens = request.max_tokens || env.get('PERPLEXITY_MAX_TOKENS', 4000)
    const temperature = request.temperature ?? env.get('PERPLEXITY_TEMPERATURE', 0.2)

    try {
      logger.info('Perplexity API request with domain filter', {
        search_type: request.search_type,
        domains_count: domains.length,
        model,
      })

      const response = await this.client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(request.search_type),
          },
          {
            role: 'user',
            content: request.query,
          },
        ],
        max_tokens: maxTokens,
        temperature,
        search_mode: request.search_mode,
        search_domain_filter: domains,
        return_related_questions: true,
        return_images: false,
      } as any)

      const choice = response.choices[0]
      const messageContent = choice?.message?.content
      const content =
        typeof messageContent === 'string'
          ? messageContent
          : Array.isArray(messageContent)
            ? messageContent.map((chunk: any) => chunk.text || '').join('')
            : ''

      return {
        content,
        search_results: this.formatSearchResults(response.search_results as any),
        related_questions: (response as any).related_questions || [],
        usage: response.usage
          ? {
              prompt_tokens: response.usage.prompt_tokens,
              completion_tokens: response.usage.completion_tokens,
              total_tokens: response.usage.total_tokens,
            }
          : undefined,
        model: response.model,
      }
    } catch (error) {
      logger.error('Perplexity API error with domain filter', {
        error: error.message,
        search_type: request.search_type,
        domains_count: domains.length,
      })

      throw new Error(`Perplexity API request failed: ${error.message}`)
    }
  }

  /**
   * Get system prompt based on search type
   */
  private getSystemPrompt(searchType: IPerplexity.SearchType): string {
    const prompts: Record<IPerplexity.SearchType, string> = {
      legal_research: `Você é um assistente jurídico especializado em pesquisa jurisprudencial brasileira.
Sua função é encontrar e sintetizar decisões judiciais relevantes, destacando:
- Ementas e súmulas aplicáveis
- Teses jurídicas predominantes
- Divergências entre tribunais
- Precedentes vinculantes
Sempre cite as fontes e datas das decisões. Responda em português do Brasil de forma técnica e precisa.`,

      legislation: `Você é um especialista em legislação brasileira.
Sua função é localizar e explicar normas jurídicas (leis, decretos, resoluções), destacando:
- Texto legal aplicável
- Alterações e atualizações
- Regulamentação e jurisprudência relacionada
- Aplicação prática
Sempre cite os artigos específicos e a data de publicação. Responda em português do Brasil de forma técnica.`,

      case_analysis: `Você é um advogado especialista em análise estratégica de casos.
Sua função é avaliar casos jurídicos, fornecendo:
- Análise de viabilidade jurídica
- Precedentes similares
- Riscos e probabilidades
- Estratégias processuais
- Argumentos favoráveis e desfavoráveis
Seja objetivo e baseie-se em jurisprudência consolidada. Responda em português do Brasil.`,

      legal_writing: `Você é um especialista em redação jurídica brasileira.
Sua função é auxiliar na elaboração de peças processuais, oferecendo:
- Estrutura adequada ao tipo de peça
- Fundamentação jurídica sólida
- Linguagem técnica apropriada
- Citações de jurisprudência e doutrina
Siga as normas da ABNT e o estilo formal do processo civil brasileiro. Responda em português do Brasil.`,

      general: `Você é um assistente jurídico geral especializado em direito brasileiro.
Forneça respostas precisas, técnicas e fundamentadas em legislação e jurisprudência.
Sempre cite suas fontes. Responda em português do Brasil.`,
    }

    return prompts[searchType] || prompts.general
  }

  /**
   * Format search results from Perplexity response
   */
  private formatSearchResults(results: any[] | undefined): IPerplexity.SearchResult[] | undefined {
    if (!results || !Array.isArray(results)) {
      return undefined
    }

    return results.map((result) => ({
      title: result.title || 'Untitled',
      url: result.url || '',
      date: result.date || undefined,
      snippet: result.snippet || undefined,
    }))
  }

  /**
   * Build domain list from filters
   */
  private buildDomainList(filters: IPerplexity.LegalDomainFilters): string[] {
    const domains: string[] = []

    if (filters.customDomains && filters.customDomains.length > 0) {
      domains.push(...filters.customDomains)
    }

    if (filters.includeBrazilianLegalDomains) {
      domains.push(...IPerplexity.BRAZILIAN_LEGAL_DOMAINS)
    }

    if (filters.courts && filters.courts.length > 0) {
      domains.push(...filters.courts)
    }

    if (filters.legislationOnly) {
      domains.push(...IPerplexity.LEGISLATION_DOMAINS)
    }

    // Remove duplicates
    return [...new Set(domains)]
  }

  /**
   * Test connection to Perplexity API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.chat({
        query: 'Test',
        search_type: 'general',
        max_tokens: 10,
      })

      return !!response.content
    } catch (error) {
      logger.error('Perplexity connection test failed', { error: error.message })
      return false
    }
  }
}
