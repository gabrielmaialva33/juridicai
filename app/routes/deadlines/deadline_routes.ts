import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { apiThrottle } from '#start/limiter'

const DeadlinesController = () => import('#controllers/deadlines/deadlines_controller')

// Inertia page route - TEMPORARILY PUBLIC for testing
router.get('/deadlines', async ({ inertia }) => {
  return inertia.render('deadlines/index')
}).as('deadlines.page')

router
  .group(() => {
    router.get('/upcoming', [DeadlinesController, 'upcoming']).as('deadlines.upcoming')
    router.get('/', [DeadlinesController, 'paginate']).as('deadlines.index')
    router.post('/', [DeadlinesController, 'create']).as('deadlines.store')
    router.get('/:id', [DeadlinesController, 'get']).where('id', /^\d+$/).as('deadlines.show')
    router
      .patch('/:id/complete', [DeadlinesController, 'complete'])
      .where('id', /^\d+$/)
      .as('deadlines.complete')
    router
      .patch('/:id', [DeadlinesController, 'update'])
      .where('id', /^\d+$/)
      .as('deadlines.update')
    router
      .delete('/:id', [DeadlinesController, 'delete'])
      .where('id', /^\d+$/)
      .as('deadlines.destroy')
  })
  .use([middleware.auth(), middleware.tenant(), apiThrottle])
  .prefix('/api/v1/deadlines')
