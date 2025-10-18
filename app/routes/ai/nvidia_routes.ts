import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const NvidiaController = () => import('#controllers/ai/nvidia_controller')

/**
 * NVIDIA AI Routes
 * Grouped under /api/v1/ai/nvidia
 * All routes require authentication and tenant context
 */
router
  .group(() => {
    /**
     * Document Analysis
     * POST /api/v1/ai/nvidia/document-analysis
     * Analyze legal documents to extract key information
     */
    router.post('/document-analysis', [NvidiaController, 'documentAnalysis'])

    /**
     * Contract Review
     * POST /api/v1/ai/nvidia/contract-review
     * Review contracts for risks, compliance, and missing clauses
     */
    router.post('/contract-review', [NvidiaController, 'contractReview'])

    /**
     * Code Generation
     * POST /api/v1/ai/nvidia/code-generation
     * Generate legal document templates and text
     */
    router.post('/code-generation', [NvidiaController, 'codeGeneration'])

    /**
     * Text Analysis
     * POST /api/v1/ai/nvidia/text-analysis
     * Analyze and extract structured data from text
     */
    router.post('/text-analysis', [NvidiaController, 'textAnalysis'])

    /**
     * Query History
     * GET /api/v1/ai/nvidia/query-history
     * Get paginated list of queries with filters
     */
    router.get('/query-history', [NvidiaController, 'queryHistory'])

    /**
     * Get Single Query
     * GET /api/v1/ai/nvidia/query/:id
     * Retrieve a specific query by ID
     */
    router.get('/query/:id', [NvidiaController, 'getQuery'])

    /**
     * Usage Statistics
     * GET /api/v1/ai/nvidia/stats
     * Get token usage and query statistics
     */
    router.get('/stats', [NvidiaController, 'stats'])
  })
  .prefix('/api/v1/ai/nvidia')
  .use([middleware.auth(), middleware.tenant()])

export default router
