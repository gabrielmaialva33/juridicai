import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { apiThrottle } from '#start/limiter'

const PerplexityController = () => import('#controllers/ai/perplexity_controller')

router
  .group(() => {
    // AI Search Endpoints
    router.post('/legal-research', [PerplexityController, 'legalResearch']).as('ai.legal_research')

    router.post('/legislation', [PerplexityController, 'legislation']).as('ai.legislation')

    router.post('/case-analysis', [PerplexityController, 'caseAnalysis']).as('ai.case_analysis')

    router
      .post('/writing-assistant', [PerplexityController, 'writingAssistant'])
      .as('ai.writing_assistant')

    // Search History & Stats
    router
      .get('/search-history', [PerplexityController, 'searchHistory'])
      .as('ai.search_history.index')

    router
      .get('/search-history/:id', [PerplexityController, 'getSearch'])
      .where('id', /^\d+$/)
      .as('ai.search_history.show')

    router
      .delete('/search-history/:id', [PerplexityController, 'deleteSearch'])
      .where('id', /^\d+$/)
      .as('ai.search_history.destroy')

    router.get('/stats', [PerplexityController, 'stats']).as('ai.stats')
  })
  .use([middleware.auth(), middleware.tenant(), apiThrottle])
  .prefix('/api/v1/ai')
