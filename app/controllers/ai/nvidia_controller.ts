import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import DocumentAnalysisService from '#services/nvidia/document_analysis_service'
import ContractReviewService from '#services/nvidia/contract_review_service'
import CodeGenerationService from '#services/nvidia/code_generation_service'
import NvidiaQueriesRepository from '#repositories/nvidia_queries_repository'
import NvidiaQuery from '#models/nvidia_query'
import {
  documentAnalysisValidator,
  contractReviewValidator,
  codeGenerationValidator,
  textAnalysisValidator,
  queryHistoryValidator,
} from '#validators/nvidia'

/**
 * NVIDIA AI Controller
 *
 * Handles HTTP requests for NVIDIA AI integration endpoints
 * Provides document analysis, contract review, code generation, and query history
 */
@inject()
export default class NvidiaController {
  constructor(
    private documentAnalysisService: DocumentAnalysisService,
    private contractReviewService: ContractReviewService,
    private codeGenerationService: CodeGenerationService,
    private queriesRepository: NvidiaQueriesRepository
  ) {}

  /**
   * Analyze a legal document
   * POST /api/v1/ai/nvidia/document-analysis
   */
  async documentAnalysis({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(documentAnalysisValidator)

      const result = await this.documentAnalysisService.analyze(payload)

      return response.ok({
        message: 'Document analyzed successfully',
        data: {
          query_id: result.query.id,
          response: result.response,
          metadata: result.metadata,
          tokens_used: result.query.tokens_used,
          created_at: result.query.created_at,
        },
      })
    } catch (error) {
      return response.badRequest({
        message: 'Document analysis failed',
        error: error.message,
      })
    }
  }

  /**
   * Review a legal contract
   * POST /api/v1/ai/nvidia/contract-review
   */
  async contractReview({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(contractReviewValidator)

      const result = await this.contractReviewService.review(payload)

      return response.ok({
        message: 'Contract reviewed successfully',
        data: {
          query_id: result.query.id,
          response: result.response,
          metadata: result.metadata,
          tokens_used: result.query.tokens_used,
          created_at: result.query.created_at,
        },
      })
    } catch (error) {
      return response.badRequest({
        message: 'Contract review failed',
        error: error.message,
      })
    }
  }

  /**
   * Generate legal document or template
   * POST /api/v1/ai/nvidia/code-generation
   */
  async codeGeneration({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(codeGenerationValidator)

      const result = await this.codeGenerationService.generate(payload)

      return response.ok({
        message: 'Document generated successfully',
        data: {
          query_id: result.query.id,
          response: result.response,
          metadata: result.metadata,
          tokens_used: result.query.tokens_used,
          created_at: result.query.created_at,
        },
      })
    } catch (error) {
      return response.badRequest({
        message: 'Code generation failed',
        error: error.message,
      })
    }
  }

  /**
   * Analyze text
   * POST /api/v1/ai/nvidia/text-analysis
   */
  async textAnalysis({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(textAnalysisValidator)

      // Use document analysis service for text analysis
      const result = await this.documentAnalysisService.analyze({
        document_text: payload.text,
        analysis_type: 'full',
        model: payload.model,
        temperature: payload.temperature,
        top_p: payload.top_p,
        max_tokens: payload.max_tokens,
        case_id: payload.case_id,
      })

      return response.ok({
        message: 'Text analyzed successfully',
        data: {
          query_id: result.query.id,
          response: result.response,
          metadata: result.metadata,
          tokens_used: result.query.tokens_used,
          created_at: result.query.created_at,
        },
      })
    } catch (error) {
      return response.badRequest({
        message: 'Text analysis failed',
        error: error.message,
      })
    }
  }

  /**
   * Get query history with filters and pagination
   * GET /api/v1/ai/nvidia/query-history
   */
  async queryHistory({ request, response }: HttpContext) {
    try {
      const filters = await request.validateUsing(queryHistoryValidator)

      const page = filters.page || 1
      const limit = filters.limit || 20

      let query = NvidiaQuery.query()

      // Apply filters
      if (filters.query_type) {
        query = query.withScopes((scopes) =>
          scopes.ofType(filters.query_type!)
        )
      }

      if (filters.user_id) {
        query = query.withScopes((scopes) =>
          scopes.byUser(filters.user_id!)
        )
      }

      if (filters.case_id) {
        query = query.withScopes((scopes) =>
          scopes.byCase(filters.case_id!)
        )
      }

      if (filters.search) {
        query = query.withScopes((scopes) =>
          scopes.search(filters.search!)
        )
      }

      // Always order by newest
      query = query.withScopes((scopes) =>
        scopes.newest()
      )

      // Paginate
      const results = await query.paginate(page, limit)

      return response.ok({
        message: 'Query history retrieved successfully',
        data: results.all(),
        meta: results.getMeta(),
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve query history',
        error: error.message,
      })
    }
  }

  /**
   * Get a single query by ID
   * GET /api/v1/ai/nvidia/query/:id
   */
  async getQuery({ params, response }: HttpContext) {
    try {
      const queryId = +params.id

      const query = await this.queriesRepository.findBy('id', queryId)

      if (!query) {
        return response.notFound({ message: 'Query not found' })
      }

      return response.ok({
        message: 'Query retrieved successfully',
        data: query,
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve query',
        error: error.message,
      })
    }
  }

  /**
   * Get usage statistics
   * GET /api/v1/ai/nvidia/stats
   */
  async stats({ request, response }: HttpContext) {
    try {
      const days = request.input('days', 30)

      const [totalTokens, countByType] = await Promise.all([
        this.queriesRepository.getTotalTokensForTenant(days),
        this.queriesRepository.getCountByType(days),
      ])

      return response.ok({
        message: 'Statistics retrieved successfully',
        data: {
          period_days: days,
          total_tokens_used: totalTokens,
          queries_by_type: countByType,
          total_queries: Object.values(countByType).reduce((sum, count) => sum + count, 0),
        },
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve statistics',
        error: error.message,
      })
    }
  }
}
