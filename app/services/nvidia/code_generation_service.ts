import { inject } from '@adonisjs/core'
import NvidiaClientService from '#services/nvidia/nvidia_client_service'
import NvidiaQueriesRepository from '#repositories/nvidia_queries_repository'
import INvidia from '#interfaces/nvidia_interface'
import logger from '@adonisjs/core/services/logger'
import TenantContextService from '#services/tenants/tenant_context_service'

/**
 * Code Generation Service
 *
 * Specialized service for generating legal document templates and text snippets
 * Creates petitions, contracts, legal opinions, and other legal documents
 *
 * @class CodeGenerationService
 * @example
 * const service = await app.container.make(CodeGenerationService)
 * const result = await service.generate({
 *   template_type: 'petição inicial',
 *   context: 'Ação de indenização por danos morais...',
 *   style: 'formal'
 * })
 */
@inject()
export default class CodeGenerationService {
  constructor(
    private nvidiaClient: NvidiaClientService,
    private queriesRepository: NvidiaQueriesRepository
  ) {}

  /**
   * Generate legal document or template
   *
   * @param request - Code generation request
   * @returns Service response with generated content
   */
  async generate(
    request: Omit<INvidia.CodeGenerationRequest, 'query' | 'query_type'>
  ): Promise<INvidia.ServiceResponse> {
    const query = this.buildQuery(request)

    logger.info('Code generation request', {
      template_type: request.template_type,
      style: request.style || 'formal',
      context_length: request.context.length,
    })

    try {
      // Call NVIDIA AI with higher max_tokens for document generation
      const response = await this.nvidiaClient.chat({
        query,
        query_type: 'code_generation',
        model: request.model,
        temperature: request.temperature || 0.6,
        top_p: request.top_p,
        max_tokens: request.max_tokens || 6000, // Higher default for document generation
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
        query_type: 'code_generation',
        model: response.model,
        temperature: request.temperature || 0.6,
        top_p: request.top_p || null,
        tokens_used: response.usage?.total_tokens || null,
        prompt_tokens: response.usage?.prompt_tokens || null,
        completion_tokens: response.usage?.completion_tokens || null,
        metadata: {
          template_type: request.template_type,
          style: request.style || 'formal',
          context_length: request.context.length,
        },
        case_id: request.case_id || null,
      })

      logger.info('Code generation completed', {
        query_id: queryRecord.id,
        tokens_used: response.usage?.total_tokens,
        template_type: request.template_type,
      })

      return {
        query: queryRecord,
        response: response.content,
        metadata: {
          template_type: request.template_type,
          style: request.style || 'formal',
        },
      }
    } catch (error) {
      logger.error('Code generation failed', {
        error: error.message,
        template_type: request.template_type,
      })
      throw error
    }
  }

  /**
   * Build optimized query for code generation
   */
  private buildQuery(request: Omit<INvidia.CodeGenerationRequest, 'query' | 'query_type'>): string {
    const style = request.style || 'formal'
    const templateType = request.template_type.toLowerCase()

    let query = `Gere um(a) ${request.template_type} profissional com base no seguinte contexto:\n\n`
    query += `${request.context}\n\n`

    // Add specific instructions based on template type
    if (templateType.includes('petição') || templateType.includes('peticao')) {
      query += `Estruture a petição seguindo o formato padrão:\n`
      query += `1. Endereçamento ao juízo competente\n`
      query += `2. Qualificação das partes (autor e réu)\n`
      query += `3. Dos fatos (narrativa clara e cronológica)\n`
      query += `4. Do direito (fundamentação jurídica com citação de leis e jurisprudência)\n`
      query += `5. Dos pedidos (claro, específico e juridicamente possível)\n`
      query += `6. Valor da causa\n`
      query += `7. Requerimentos finais\n`
      query += `8. Local, data e assinatura\n`
    } else if (templateType.includes('contrato')) {
      query += `Estruture o contrato seguindo o formato padrão:\n`
      query += `1. Título do contrato\n`
      query += `2. Qualificação das partes contratantes\n`
      query += `3. Objeto do contrato\n`
      query += `4. Cláusulas essenciais (obrigações, prazo, valor, forma de pagamento)\n`
      query += `5. Cláusulas de garantia e responsabilidade\n`
      query += `6. Condições de rescisão\n`
      query += `7. Cláusulas de confidencialidade (se aplicável)\n`
      query += `8. Foro de eleição\n`
      query += `9. Local, data e assinaturas\n`
    } else if (templateType.includes('parecer')) {
      query += `Estruture o parecer jurídico seguindo o formato padrão:\n`
      query += `1. Consulente e objeto da consulta\n`
      query += `2. Relatório dos fatos\n`
      query += `3. Análise jurídica (com fundamentação legal e doutrinária)\n`
      query += `4. Conclusão e recomendações\n`
      query += `5. Local, data e assinatura do parecerista\n`
    } else if (templateType.includes('contestação') || templateType.includes('contestacao')) {
      query += `Estruture a contestação seguindo o formato padrão:\n`
      query += `1. Endereçamento ao juízo\n`
      query += `2. Qualificação do réu\n`
      query += `3. Preliminares (se houver)\n`
      query += `4. Do mérito (refutação dos fatos e argumentos do autor)\n`
      query += `5. Do direito (fundamentação jurídica da defesa)\n`
      query += `6. Dos pedidos\n`
      query += `7. Requerimentos finais\n`
      query += `8. Local, data e assinatura\n`
    } else if (templateType.includes('notificação') || templateType.includes('notificacao')) {
      query += `Estruture a notificação extrajudicial seguindo o formato padrão:\n`
      query += `1. Identificação do notificante\n`
      query += `2. Identificação do notificado\n`
      query += `3. Dos fatos\n`
      query += `4. Da notificação propriamente dita\n`
      query += `5. Prazo para resposta ou providências\n`
      query += `6. Advertências (se aplicável)\n`
      query += `7. Local, data e assinatura\n`
    } else {
      query += `Estruture o documento de forma profissional e apropriada ao tipo solicitado.\n`
    }

    // Add style instructions
    switch (style) {
      case 'concise':
        query += `\nEstilo: Conciso e direto, evitando redundâncias. Mantenha a formalidade mas seja objetivo.\n`
        break
      case 'detailed':
        query += `\nEstilo: Detalhado e completo, com ampla fundamentação e explicações minuciosas.\n`
        break
      case 'formal':
      default:
        query += `\nEstilo: Formal e técnico, seguindo o padrão tradicional da advocacia brasileira.\n`
        break
    }

    query += `\nRequisitos importantes:\n`
    query += `- Use linguagem técnica jurídica apropriada\n`
    query += `- Cite legislação aplicável (números de artigos e leis)\n`
    query += `- Siga as normas da ABNT para citações\n`
    query += `- Mantenha coerência e clareza na argumentação\n`
    query += `- Use formatação adequada (parágrafos, numeração, etc.)\n`
    query += `\nGere o documento completo e pronto para uso.`

    return query
  }
}
