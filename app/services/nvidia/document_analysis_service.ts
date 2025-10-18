import { inject } from '@adonisjs/core'
import NvidiaClientService from '#services/nvidia/nvidia_client_service'
import NvidiaQueriesRepository from '#repositories/nvidia_queries_repository'
import INvidia from '#interfaces/nvidia_interface'
import logger from '@adonisjs/core/services/logger'
import TenantContextService from '#services/tenants/tenant_context_service'

/**
 * Document Analysis Service
 *
 * Specialized service for analyzing legal documents
 * Extracts key information, parties, obligations, risks, and provides structured analysis
 *
 * @class DocumentAnalysisService
 * @example
 * const service = await app.container.make(DocumentAnalysisService)
 * const result = await service.analyze({
 *   document_text: 'Contrato de prestação de serviços...',
 *   analysis_type: 'full'
 * })
 */
@inject()
export default class DocumentAnalysisService {
  constructor(
    private nvidiaClient: NvidiaClientService,
    private queriesRepository: NvidiaQueriesRepository
  ) {}

  /**
   * Analyze a legal document
   *
   * @param request - Document analysis request
   * @returns Service response with AI analysis
   */
  async analyze(
    request: Omit<INvidia.DocumentAnalysisRequest, 'query' | 'query_type'>
  ): Promise<INvidia.ServiceResponse> {
    const query = this.buildQuery(request)

    logger.info('Document analysis request', {
      analysis_type: request.analysis_type || 'full',
      document_length: request.document_text.length,
    })

    try {
      // Call NVIDIA AI
      const response = await this.nvidiaClient.chat({
        query,
        query_type: 'document_analysis',
        model: request.model,
        temperature: request.temperature || 0.5,
        top_p: request.top_p,
        max_tokens: request.max_tokens,
        case_id: request.case_id,
      })

      // Get tenant context
      const tenantContext = await TenantContextService.getContext()
      if (!tenantContext) {
        throw new Error('Tenant context is required')
      }

      // Save query to database
      const queryRecord = await this.queriesRepository.create({
        user_id: tenantContext.user_id!,
        query,
        response: response.content,
        query_type: 'document_analysis',
        model: response.model,
        temperature: request.temperature || 0.5,
        top_p: request.top_p || null,
        tokens_used: response.usage?.total_tokens || null,
        prompt_tokens: response.usage?.prompt_tokens || null,
        completion_tokens: response.usage?.completion_tokens || null,
        metadata: {
          analysis_type: request.analysis_type || 'full',
          document_length: request.document_text.length,
        },
        case_id: request.case_id || null,
      })

      logger.info('Document analysis completed', {
        query_id: queryRecord.id,
        tokens_used: response.usage?.total_tokens,
      })

      return {
        query: queryRecord,
        response: response.content,
        metadata: {
          analysis_type: request.analysis_type || 'full',
        },
      }
    } catch (error) {
      logger.error('Document analysis failed', {
        error: error.message,
        analysis_type: request.analysis_type,
      })
      throw error
    }
  }

  /**
   * Build optimized query for document analysis
   */
  private buildQuery(
    request: Omit<INvidia.DocumentAnalysisRequest, 'query' | 'query_type'>
  ): string {
    const analysisType = request.analysis_type || 'full'

    let query = `Analise o seguinte documento jurídico:\n\n${request.document_text}\n\n`

    switch (analysisType) {
      case 'summary':
        query += 'Forneça um resumo executivo do documento, destacando os pontos principais.'
        break

      case 'key_points':
        query +=
          'Identifique e liste os pontos-chave do documento, incluindo cláusulas importantes e condições especiais.'
        break

      case 'parties':
        query +=
          'Identifique todas as partes envolvidas no documento (autores, réus, testemunhas, contratantes, contratados, etc.) e seus papéis.'
        break

      case 'obligations':
        query +=
          'Extraia e liste todas as obrigações e direitos de cada parte envolvida no documento.'
        break

      case 'risks':
        query +=
          'Identifique potenciais riscos jurídicos, cláusulas problemáticas e pontos de atenção neste documento.'
        break

      case 'full':
      default:
        query += `Forneça uma análise completa incluindo:\n`
        query += `1. Resumo executivo\n`
        query += `2. Partes envolvidas e seus papéis\n`
        query += `3. Principais obrigações e direitos\n`
        query += `4. Prazos e datas importantes\n`
        query += `5. Riscos e pontos de atenção\n`
        query += `6. Questões jurídicas centrais\n`
        query += `7. Recomendações (se aplicável)\n`
        break
    }

    query += `\n\nOrganize sua resposta de forma clara e estruturada.`

    return query
  }
}
