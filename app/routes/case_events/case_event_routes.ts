import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { apiThrottle } from '#start/limiter'

const CaseEventsController = () => import('#controllers/case_events/case_events_controller')

router
  .group(() => {
    router
      .get('/', [CaseEventsController, 'paginate'])
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('case_events.index')
    router
      .post('/', [CaseEventsController, 'create'])
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('case_events.store')
    router
      .get('/:id', [CaseEventsController, 'get'])
      .where('id', /^\d+$/)
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('case_events.show')
    router
      .patch('/:id', [CaseEventsController, 'update'])
      .where('id', /^\d+$/)
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('case_events.update')
    router
      .delete('/:id', [CaseEventsController, 'delete'])
      .where('id', /^\d+$/)
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('case_events.destroy')
  })
  .prefix('/api/v1/case-events')
