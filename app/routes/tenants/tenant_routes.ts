import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { apiThrottle } from '#start/limiter'

const TenantsController = () => import('#controllers/tenants/tenants_controller')

router
  .group(() => {
    // GET /api/v1/tenants/me - Get current user's tenants
    router.get('/me', [TenantsController, 'me']).as('tenants.me')

    // GET /api/v1/tenants - List all tenants (paginated)
    router.get('/', [TenantsController, 'index']).as('tenants.index')

    // POST /api/v1/tenants - Create a new tenant
    router.post('/', [TenantsController, 'store']).as('tenants.store')

    // GET /api/v1/tenants/:id - Get tenant details
    router
      .get('/:id', [TenantsController, 'show'])
      .where('id', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/) // UUID regex
      .as('tenants.show')

    // PATCH /api/v1/tenants/:id - Update tenant
    router
      .patch('/:id', [TenantsController, 'update'])
      .where('id', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      .as('tenants.update')

    // DELETE /api/v1/tenants/:id - Deactivate tenant
    router
      .delete('/:id', [TenantsController, 'destroy'])
      .where('id', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      .as('tenants.destroy')
  })
  .use([middleware.auth(), apiThrottle])
  .prefix('/api/v1/tenants')
