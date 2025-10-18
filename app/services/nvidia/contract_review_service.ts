import { inject } from '@adonisjs/core'
import NvidiaClientService from '#services/nvidia/nvidia_client_service'
import NvidiaQueriesRepository from '#repositories/nvidia_queries_repository'
import INvidia from '#interfaces/nvidia_interface'
import logger from '@adonisjs/core/services/logger'
import TenantContextService from '#services/tenants/tenant_context_service'

/**
 * Contract Review Service
 *
 * Specialized service for reviewing legal contracts
 * Identifies risks, missing clauses, compliance issues, and suggests improvements
 *
 * @class ContractReviewService
 * @example
 * const service = await app.container.make(ContractReviewService)
 * const result = await service.review({
 *   contract_text: 'Contrato de prestação de serviços...',
 *   review_focus: ['risks', 'compliance']
 * })
 */
@inject()
export default class ContractReviewService {
  constructor(
    private nvidiaClient: NvidiaClientService,
    private queriesRepository: NvidiaQueriesRepository
  ) {}

  /**
   * Review a legal contract
   *
   * @param request - Contract review request
   * @returns Service response with review and recommendations
   */
  async review(
    request: Omit<INvidia.ContractReviewRequest, 'query' | 'query_type'>
  ): Promise<INvidia.ServiceResponse> {
    const query = this.buildQuery(request)

    logger.info('Contract review request', {
      review_focus: request.review_focus || ['all'],
      contract_length: request.contract_text.length,
    })

    try {
      // Call NVIDIA AI
      const response = await this.nvidiaClient.chat({
        query,
        query_type: 'contract_review',
        model: request.model,
        temperature: request.temperature || 0.4,
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
        query_type: 'contract_review',
        model: response.model,
        temperature: request.temperature || 0.4,
        top_p: request.top_p || null,
        tokens_used: response.usage?.total_tokens || null,
        prompt_tokens: response.usage?.prompt_tokens || null,
        completion_tokens: response.usage?.completion_tokens || null,
        metadata: {
          review_focus: request.review_focus || ['all'],
          contract_length: request.contract_text.length,
        },
        case_id: request.case_id || null,
      })

      logger.info('Contract review completed', {
        query_id: queryRecord.id,
        tokens_used: response.usage?.total_tokens,
      })

      return {
        query: queryRecord,
        response: response.content,
        metadata: {
          review_focus: request.review_focus || ['all'],
        },
      }
    } catch (error) {
      logger.error('Contract review failed', {
        error: error.message,
        review_focus: request.review_focus,
      })
      throw error
    }
  }

  /**
   * Build optimized query for contract review
   */
  private buildQuery(request: Omit<INvidia.ContractReviewRequest, 'query' | 'query_type'>): string {
    const focus = request.review_focus || ['all']

    let query = `Revise o seguinte contrato jurídico:\n\n${request.contract_text}\n\n`

    if (focus.includes('all')) {
      query += `Forneça uma revisão completa do contrato, incluindo:\n`
      query += `1. Riscos jurídicos e comerciais identificados\n`
      query += `2. Cláusulas ausentes ou inadequadas\n`
      query += `3. Conformidade com legislação brasileira (Código Civil, CLT, CDC, etc.)\n`
      query += `4. Obrigações e responsabilidades de cada parte\n`
      query += `5. Condições de rescisão e penalidades\n`
      query += `6. Sugestões de melhorias e cláusulas adicionais recomendadas\n`
    } else {
      query += `Foque sua revisão nos seguintes aspectos:\n`

      if (focus.includes('risks')) {
        query += `- Riscos jurídicos e comerciais: identifique cláusulas arriscadas e potenciais problemas\n`
      }

      if (focus.includes('missing_clauses')) {
        query += `- Cláusulas ausentes: identifique cláusulas importantes que deveriam estar presentes\n`
      }

      if (focus.includes('compliance')) {
        query += `- Conformidade legal: verifique a conformidade com CC, CLT, CDC, LGPD e outras normas aplicáveis\n`
      }

      if (focus.includes('obligations')) {
        query += `- Obrigações: analise as obrigações e responsabilidades de cada parte contratante\n`
      }
    }

    query += `\n\nOrganize sua resposta de forma clara, estruturada e prática.`
    query += ` Para cada ponto identificado, forneça:\n`
    query += `- Descrição do problema ou ponto de atenção\n`
    query += `- Fundamentação legal (quando aplicável)\n`
    query += `- Sugestão de melhoria ou cláusula alternativa\n`

    return query
  }
}
