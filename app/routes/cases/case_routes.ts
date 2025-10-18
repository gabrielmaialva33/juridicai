import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { apiThrottle } from '#start/limiter'

const CasesController = () => import('#controllers/cases/cases_controller')

// Inertia page route
router.get('/cases', [CasesController, 'index']).as('cases.page')
// .use([middleware.auth(), middleware.tenant()]) // TEMPORARILY DISABLED for layout testing

// API routes
router
  .group(() => {
    router.get('/', [CasesController, 'paginate']).as('cases.index')
    router.post('/', [CasesController, 'create']).as('cases.store')
    router.get('/:id', [CasesController, 'get']).where('id', /^\d+$/).as('cases.show')
    router.patch('/:id', [CasesController, 'update']).where('id', /^\d+$/).as('cases.update')
    router.delete('/:id', [CasesController, 'delete']).where('id', /^\d+$/).as('cases.destroy')
  })
  .use([middleware.auth(), middleware.tenant(), apiThrottle])
  .prefix('/api/v1/cases')
