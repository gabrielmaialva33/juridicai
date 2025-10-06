import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { apiThrottle } from '#start/limiter'

const DeadlinesController = () => import('#controllers/deadlines/deadlines_controller')

router
  .group(() => {
    router
      .get('/upcoming', [DeadlinesController, 'upcoming'])
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('deadlines.upcoming')
    router
      .get('/', [DeadlinesController, 'paginate'])
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('deadlines.index')
    router
      .post('/', [DeadlinesController, 'create'])
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('deadlines.store')
    router
      .get('/:id', [DeadlinesController, 'get'])
      .where('id', /^\d+$/)
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('deadlines.show')
    router
      .patch('/:id/complete', [DeadlinesController, 'complete'])
      .where('id', /^\d+$/)
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('deadlines.complete')
    router
      .patch('/:id', [DeadlinesController, 'update'])
      .where('id', /^\d+$/)
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('deadlines.update')
    router
      .delete('/:id', [DeadlinesController, 'delete'])
      .where('id', /^\d+$/)
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('deadlines.destroy')
  })
  .prefix('/api/v1/deadlines')
