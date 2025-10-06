import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { apiThrottle } from '#start/limiter'

const ClientsController = () => import('#controllers/clients/clients_controller')

router
  .group(() => {
    // GET /api/v1/clients - List all clients (paginated with filters)
    router
      .get('/', [ClientsController, 'paginate'])
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('clients.index')

    // POST /api/v1/clients - Create a new client
    router
      .post('/', [ClientsController, 'create'])
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('clients.store')

    // GET /api/v1/clients/:id - Get client details
    router
      .get('/:id', [ClientsController, 'get'])
      .where('id', /^\d+$/) // Numeric ID
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('clients.show')

    // PATCH /api/v1/clients/:id - Update client
    router
      .patch('/:id', [ClientsController, 'update'])
      .where('id', /^\d+$/)
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('clients.update')

    // DELETE /api/v1/clients/:id - Deactivate client
    router
      .delete('/:id', [ClientsController, 'delete'])
      .where('id', /^\d+$/)
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('clients.destroy')
  })
  .prefix('/api/v1/clients')
