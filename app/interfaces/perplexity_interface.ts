/**
 * Perplexity AI Integration Interface
 * Defines types for interacting with Perplexity API in legal context
 */

import type PerplexitySearch from '#models/perplexity_search'

namespace IPerplexity {
  /**
   * Supported search types for legal domain
   */
  export type SearchType =
    | 'legal_research' // Pesquisa jurisprudencial
    | 'legislation' // Consulta legislação
    | 'case_analysis' // Análise de casos similares
    | 'legal_writing' // Assistente de redação
    | 'general' // Pesquisa geral

  /**
   * Perplexity search mode
   */
  export type SearchMode = 'web' | 'academic'

  /**
   * Recency filter options
   */
  export type RecencyFilter = 'day' | 'week' | 'month' | 'year'

  /**
   * Brazilian legal domain filters
   */
  export interface LegalDomainFilters {
    /** Filter to include only Brazilian government and legal domains */
    includeBrazilianLegalDomains?: boolean
    /** Filter to include only specific courts */
    courts?: string[] // e.g., ['stf.jus.br', 'tjsp.jus.br']
    /** Filter to include only legislation sites */
    legislationOnly?: boolean
    /** Custom domain list */
    customDomains?: string[]
  }

  /**
   * Search result from Perplexity
   */
  export interface SearchResult {
    title: string
    url: string
    date?: string
    snippet?: string
  }

  /**
   * Metadata for search configuration and results
   */
  export interface SearchMetadata {
    domain_filter?: string[]
    recency_filter?: RecencyFilter
    related_questions?: string[]
    temperature?: number
    max_tokens?: number
    search_mode?: SearchMode
    [key: string]: any
  }

  /**
   * Base request for Perplexity API
   */
  export interface BaseRequest {
    /** User query */
    query: string
    /** Search type */
    search_type: SearchType
    /** Perplexity model to use */
    model?: string
    /** Search mode (web or academic) */
    search_mode?: SearchMode
    /** Maximum tokens in response */
    max_tokens?: number
    /** Temperature (0-2) */
    temperature?: number
    /** Optional case ID for association */
    case_id?: number | null
  }

  /**
   * Request for legal research (jurisprudência)
   */
  export interface LegalResearchRequest extends BaseRequest {
    search_type: 'legal_research'
    /** Legal topic or issue */
    topic: string
    /** Specific court or jurisdiction */
    court?: string
    /** Year range for decisions */
    year_range?: {
      from?: number
      to?: number
    }
    /** Recency filter */
    recency?: RecencyFilter
    /** Domain filters */
    domain_filters?: LegalDomainFilters
  }

  /**
   * Request for legislation search
   */
  export interface LegislationSearchRequest extends BaseRequest {
    search_type: 'legislation'
    /** Topic or legal area */
    topic: string
    /** Type of legislation (lei, decreto, etc) */
    legislation_type?: string
    /** Recency filter */
    recency?: RecencyFilter
  }

  /**
   * Request for case analysis
   */
  export interface CaseAnalysisRequest extends BaseRequest {
    search_type: 'case_analysis'
    /** Case summary or key facts */
    case_summary: string
    /** Legal area */
    legal_area?: string
    /** Specific questions about the case */
    questions?: string[]
  }

  /**
   * Request for legal writing assistance
   */
  export interface LegalWritingRequest extends BaseRequest {
    search_type: 'legal_writing'
    /** Type of document */
    document_type: string // e.g., 'petição inicial', 'contestação'
    /** Context for the document */
    context: string
    /** Tone/style */
    style?: 'formal' | 'concise' | 'detailed'
  }

  /**
   * General search request
   */
  export interface GeneralSearchRequest extends BaseRequest {
    search_type: 'general'
  }

  /**
   * Union type for all request types
   */
  export type SearchRequest =
    | LegalResearchRequest
    | LegislationSearchRequest
    | CaseAnalysisRequest
    | LegalWritingRequest
    | GeneralSearchRequest

  /**
   * Perplexity API response
   */
  export interface PerplexityResponse {
    /** AI-generated response */
    content: string
    /** Search results (sources) */
    search_results?: SearchResult[]
    /** Related questions suggested by Perplexity */
    related_questions?: string[]
    /** Token usage */
    usage?: {
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
    }
    /** Model used */
    model: string
  }

  /**
   * Service response after processing
   */
  export interface ServiceResponse {
    /** The search record created/retrieved */
    search: PerplexitySearch
    /** AI response */
    response: string
    /** Sources */
    sources?: SearchResult[]
    /** Related questions */
    related_questions?: string[]
    /** Whether response was cached */
    cached?: boolean
  }

  /**
   * Cache configuration
   */
  export interface CacheConfig {
    /** Cache TTL in seconds */
    ttl: number
    /** Whether to use cache */
    enabled: boolean
    /** Cache key prefix */
    prefix?: string
  }

  /**
   * Brazilian legal domain constants
   */
  export const BRAZILIAN_LEGAL_DOMAINS = [
    'stf.jus.br',
    'stj.jus.br',
    'tst.jus.br',
    'trf1.jus.br',
    'trf2.jus.br',
    'trf3.jus.br',
    'trf4.jus.br',
    'trf5.jus.br',
    'trf6.jus.br',
    'tjsp.jus.br',
    'tjrj.jus.br',
    'tjmg.jus.br',
    'tjrs.jus.br',
    'tjpr.jus.br',
    'tjsc.jus.br',
    'planalto.gov.br',
    'senado.leg.br',
    'camara.leg.br',
    'conjur.com.br',
    'jusbrasil.com.br',
    'migalhas.com.br',
  ]

  /**
   * Supreme Court domains (STF, STJ)
   */
  export const SUPREME_COURTS = ['stf.jus.br', 'stj.jus.br']

  /**
   * Federal courts domains
   */
  export const FEDERAL_COURTS = [
    'trf1.jus.br',
    'trf2.jus.br',
    'trf3.jus.br',
    'trf4.jus.br',
    'trf5.jus.br',
    'trf6.jus.br',
  ]

  /**
   * Legislation domains
   */
  export const LEGISLATION_DOMAINS = [
    'planalto.gov.br',
    'senado.leg.br',
    'camara.leg.br',
  ]
}

export default IPerplexity
