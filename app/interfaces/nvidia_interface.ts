/**
 * NVIDIA AI Integration Interface
 * Defines types for interacting with NVIDIA API in legal context
 */

import type NvidiaQuery from '#models/nvidia_query'

namespace INvidia {
  /**
   * Supported query types for legal domain
   */
  export type QueryType =
    | 'document_analysis' // Análise de documentos
    | 'contract_review' // Revisão de contratos
    | 'code_generation' // Geração de templates
    | 'text_analysis' // Análise de texto
    | 'general' // Consulta geral

  /**
   * Chat message format
   */
  export interface ChatMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
  }

  /**
   * Stream chunk from NVIDIA API
   */
  export interface StreamChunk {
    content: string
    finish_reason?: string | null
  }

  /**
   * Query metadata
   */
  export interface QueryMetadata {
    analysis_type?: string
    review_focus?: string[]
    template_type?: string
    context?: string
    temperature?: number
    top_p?: number
    max_tokens?: number
    [key: string]: any
  }

  /**
   * Base request for NVIDIA API
   */
  export interface BaseRequest {
    /** User query */
    query: string
    /** Query type */
    query_type: QueryType
    /** NVIDIA model to use */
    model?: string
    /** Temperature (0-2) */
    temperature?: number
    /** Top P (0-1) */
    top_p?: number
    /** Maximum tokens in response */
    max_tokens?: number
    /** Enable streaming */
    stream?: boolean
    /** Optional case ID for association */
    case_id?: number | null
  }

  /**
   * Request for document analysis
   */
  export interface DocumentAnalysisRequest extends BaseRequest {
    query_type: 'document_analysis'
    /** Document text to analyze */
    document_text: string
    /** Type of analysis (optional) */
    analysis_type?: 'summary' | 'key_points' | 'parties' | 'obligations' | 'risks' | 'full'
  }

  /**
   * Request for contract review
   */
  export interface ContractReviewRequest extends BaseRequest {
    query_type: 'contract_review'
    /** Contract text to review */
    contract_text: string
    /** Focus areas for review (optional) */
    review_focus?: ('risks' | 'missing_clauses' | 'compliance' | 'obligations' | 'all')[]
  }

  /**
   * Request for code generation
   */
  export interface CodeGenerationRequest extends BaseRequest {
    query_type: 'code_generation'
    /** Type of template to generate */
    template_type: string // e.g., 'petição inicial', 'contrato', 'parecer'
    /** Context for generation */
    context: string
    /** Tone/style */
    style?: 'formal' | 'concise' | 'detailed'
  }

  /**
   * Request for text analysis
   */
  export interface TextAnalysisRequest extends BaseRequest {
    query_type: 'text_analysis'
    /** Text to analyze */
    text: string
    /** Analysis goal */
    goal?: string
  }

  /**
   * General query request
   */
  export interface GeneralQueryRequest extends BaseRequest {
    query_type: 'general'
  }

  /**
   * Union type for all request types
   */
  export type QueryRequest =
    | DocumentAnalysisRequest
    | ContractReviewRequest
    | CodeGenerationRequest
    | TextAnalysisRequest
    | GeneralQueryRequest

  /**
   * NVIDIA API response
   */
  export interface NvidiaResponse {
    /** AI-generated response */
    content: string
    /** Token usage */
    usage?: {
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
    }
    /** Model used */
    model: string
    /** Finish reason */
    finish_reason?: string
  }

  /**
   * Service response after processing
   */
  export interface ServiceResponse {
    /** The query record created */
    query: NvidiaQuery
    /** AI response */
    response: string
    /** Metadata about the query */
    metadata?: QueryMetadata
  }
}

export default INvidia
