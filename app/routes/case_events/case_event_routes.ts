import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { apiThrottle } from '#start/limiter'

const CaseEventsController = () => import('#controllers/case_events/case_events_controller')

router
  .group(() => {
    router.get('/', [CaseEventsController, 'paginate']).as('case_events.index')
    router.post('/', [CaseEventsController, 'create']).as('case_events.store')
    router.get('/:id', [CaseEventsController, 'get']).where('id', /^\d+$/).as('case_events.show')
    router
      .patch('/:id', [CaseEventsController, 'update'])
      .where('id', /^\d+$/)
      .as('case_events.update')
    router
      .delete('/:id', [CaseEventsController, 'delete'])
      .where('id', /^\d+$/)
      .as('case_events.destroy')
  })
  .use([middleware.auth(), middleware.tenant(), apiThrottle])
  .prefix('/api/v1/case-events')
