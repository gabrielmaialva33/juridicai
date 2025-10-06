import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { apiThrottle } from '#start/limiter'

const CasesController = () => import('#controllers/cases/cases_controller')

router
  .group(() => {
    router
      .get('/', [CasesController, 'paginate'])
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('cases.index')
    router
      .post('/', [CasesController, 'create'])
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('cases.store')
    router
      .get('/:id', [CasesController, 'get'])
      .where('id', /^\d+$/)
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('cases.show')
    router
      .patch('/:id', [CasesController, 'update'])
      .where('id', /^\d+$/)
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('cases.update')
    router
      .delete('/:id', [CasesController, 'delete'])
      .where('id', /^\d+$/)
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('cases.destroy')
  })
  .prefix('/api/v1/cases')
