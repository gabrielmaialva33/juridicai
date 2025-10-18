import { inject } from '@adonisjs/core'
import env from '#start/env'
import OpenAI from 'openai'
import INvidia from '#interfaces/nvidia_interface'
import logger from '@adonisjs/core/services/logger'

/**
 * NVIDIA Client Service
 *
 * Base service for interacting with NVIDIA AI API using OpenAI SDK
 * Handles authentication, request formatting, and error handling
 *
 * @class NvidiaClientService
 * @example
 * const client = await app.container.make(NvidiaClientService)
 * const response = await client.chat({ query: '...', query_type: 'document_analysis' })
 */
@inject()
export default class NvidiaClientService {
  private client: OpenAI

  constructor() {
    const apiKey = env.get('NVIDIA_API_KEY')
    const baseURL = env.get('NVIDIA_BASE_URL')

    if (!apiKey || apiKey === 'your-nvidia-api-key') {
      throw new Error('NVIDIA_API_KEY not configured. Please set it in your .env file.')
    }

    if (!baseURL) {
      throw new Error('NVIDIA_BASE_URL not configured. Please set it in your .env file.')
    }

    this.client = new OpenAI({
      apiKey,
      baseURL,
    })
  }

  /**
   * Execute a chat completion request with NVIDIA
   *
   * @param request - Query request configuration
   * @returns NVIDIA API response with content and usage stats
   */
  async chat(request: INvidia.BaseRequest): Promise<INvidia.NvidiaResponse> {
    try {
      const model = request.model || env.get('NVIDIA_DEFAULT_MODEL')
      const temperature = request.temperature ?? env.get('NVIDIA_TEMPERATURE', 0.7)
      const topP = request.top_p ?? env.get('NVIDIA_TOP_P', 0.8)
      const maxTokens = request.max_tokens || env.get('NVIDIA_MAX_TOKENS', 4096)

      logger.info('NVIDIA API request', {
        query_type: request.query_type,
        model,
        query_length: request.query.length,
        stream: false,
      })

      const completion = await this.client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(request.query_type),
          },
          {
            role: 'user',
            content: request.query,
          },
        ],
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        stream: false,
      })

      const choice = completion.choices[0]
      const content = choice?.message?.content || ''
      const finishReason = choice?.finish_reason || undefined

      logger.info('NVIDIA API response received', {
        query_type: request.query_type,
        tokens_used: completion.usage?.total_tokens,
        finish_reason: finishReason,
      })

      return {
        content,
        usage: completion.usage
          ? {
              prompt_tokens: completion.usage.prompt_tokens,
              completion_tokens: completion.usage.completion_tokens,
              total_tokens: completion.usage.total_tokens,
            }
          : undefined,
        model: completion.model,
        finish_reason: finishReason,
      }
    } catch (error) {
      logger.error('NVIDIA API error', {
        error: error.message,
        query_type: request.query_type,
      })

      throw new Error(`NVIDIA API request failed: ${error.message}`)
    }
  }

  /**
   * Execute a streaming chat completion request with NVIDIA
   *
   * @param request - Query request configuration
   * @returns Async generator yielding stream chunks
   */
  async *chatStream(request: INvidia.BaseRequest): AsyncGenerator<INvidia.StreamChunk> {
    try {
      const model = request.model || env.get('NVIDIA_DEFAULT_MODEL')
      const temperature = request.temperature ?? env.get('NVIDIA_TEMPERATURE', 0.7)
      const topP = request.top_p ?? env.get('NVIDIA_TOP_P', 0.8)
      const maxTokens = request.max_tokens || env.get('NVIDIA_MAX_TOKENS', 4096)

      logger.info('NVIDIA API streaming request', {
        query_type: request.query_type,
        model,
        query_length: request.query.length,
        stream: true,
      })

      const completion = await this.client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(request.query_type),
          },
          {
            role: 'user',
            content: request.query,
          },
        ],
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        stream: true,
      })

      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta?.content || ''
        const finishReason = chunk.choices[0]?.finish_reason || null

        if (delta || finishReason) {
          yield {
            content: delta,
            finish_reason: finishReason,
          }
        }
      }

      logger.info('NVIDIA API streaming completed', {
        query_type: request.query_type,
      })
    } catch (error) {
      logger.error('NVIDIA API streaming error', {
        error: error.message,
        query_type: request.query_type,
      })

      throw new Error(`NVIDIA API streaming request failed: ${error.message}`)
    }
  }

  /**
   * Get system prompt based on query type
   */
  private getSystemPrompt(queryType: INvidia.QueryType): string {
    const prompts: Record<INvidia.QueryType, string> = {
      document_analysis: `Você é um assistente jurídico especializado em análise de documentos legais brasileiros.
Sua função é analisar documentos jurídicos e extrair informações relevantes, incluindo:
- Resumo executivo do documento
- Partes envolvidas (autores, réus, testemunhas, etc.)
- Obrigações e direitos identificados
- Prazos e datas importantes
- Riscos e pontos de atenção
- Questões jurídicas centrais

Sempre organize sua resposta de forma estruturada e clara. Responda em português do Brasil de forma técnica e precisa.`,

      contract_review: `Você é um especialista em revisão de contratos no direito brasileiro.
Sua função é revisar contratos e identificar:
- Riscos jurídicos e comerciais
- Cláusulas ausentes ou inadequadas
- Conformidade com legislação brasileira (CC, CLT, CDC, etc.)
- Obrigações e responsabilidades das partes
- Condições de rescisão e penalidades
- Sugestões de melhorias e cláusulas adicionais

Seja detalhado e baseie suas análises em legislação vigente. Responda em português do Brasil.`,

      code_generation: `Você é um especialista em redação jurídica brasileira.
Sua função é gerar templates e textos jurídicos de alta qualidade, incluindo:
- Petições iniciais e contestações
- Contratos e aditivos
- Pareceres jurídicos
- Notificações extrajudiciais
- Outros documentos legais

Siga as normas da ABNT e o estilo formal do direito brasileiro. Use linguagem técnica apropriada e estruture o documento de forma profissional. Responda em português do Brasil.`,

      text_analysis: `Você é um assistente jurídico especializado em análise e processamento de texto legal.
Sua função é analisar textos jurídicos e extrair informações estruturadas, identificar padrões, resumir conteúdo e fornecer insights relevantes.

Seja preciso e objetivo. Responda em português do Brasil de forma técnica.`,

      general: `Você é um assistente jurídico geral especializado em direito brasileiro.
Forneça respostas precisas, técnicas e fundamentadas em legislação e doutrina brasileira.
Responda em português do Brasil.`,
    }

    return prompts[queryType] || prompts.general
  }

  /**
   * Test connection to NVIDIA API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.chat({
        query: 'Test',
        query_type: 'general',
        max_tokens: 10,
      })

      return !!response.content
    } catch (error) {
      logger.error('NVIDIA connection test failed', { error: error.message })
      return false
    }
  }
}
