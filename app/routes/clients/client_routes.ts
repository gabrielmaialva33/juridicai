import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { apiThrottle } from '#start/limiter'

const ClientsController = () => import('#controllers/clients/clients_controller')

// Inertia page route
router.get('/clients', [ClientsController, 'index']).as('clients.page')
// .use([middleware.auth(), middleware.tenant()]) // TEMPORARILY DISABLED for layout testing

// API routes
router
  .group(() => {
    // GET /api/v1/clients - List all clients (paginated with filters)
    router.get('/', [ClientsController, 'paginate']).as('clients.index')

    // POST /api/v1/clients - Create a new client
    router.post('/', [ClientsController, 'create']).as('clients.store')

    // GET /api/v1/clients/:id - Get client details
    router
      .get('/:id', [ClientsController, 'get'])
      .where('id', /^\d+$/) // Numeric ID
      .as('clients.show')

    // PATCH /api/v1/clients/:id - Update client
    router.patch('/:id', [ClientsController, 'update']).where('id', /^\d+$/).as('clients.update')

    // DELETE /api/v1/clients/:id - Deactivate client
    router.delete('/:id', [ClientsController, 'delete']).where('id', /^\d+$/).as('clients.destroy')
  })
  .use([middleware.auth(), middleware.tenant(), apiThrottle])
  .prefix('/api/v1/clients')
