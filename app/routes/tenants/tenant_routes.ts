import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { apiThrottle } from '#start/limiter'

const TenantsController = () => import('#controllers/tenants/tenants_controller')

router
  .group(() => {
    // GET /api/v1/tenants/me - Get current tenant (requires tenant context)
    router
      .get('/me', [TenantsController, 'me'])
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('tenants.me')

    // GET /api/v1/tenants - List all tenants (paginated)
    router
      .get('/', [TenantsController, 'paginate'])
      .use([middleware.auth(), apiThrottle])
      .as('tenants.index')

    // POST /api/v1/tenants - Create a new tenant (no tenant context needed)
    router
      .post('/', [TenantsController, 'create'])
      .use([middleware.auth(), apiThrottle])
      .as('tenants.store')

    // GET /api/v1/tenants/:id - Get tenant details
    router
      .get('/:id', [TenantsController, 'get'])
      .where('id', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/) // UUID regex
      .use([middleware.auth(), apiThrottle])
      .as('tenants.show')

    // PATCH /api/v1/tenants/:id - Update tenant
    router
      .patch('/:id', [TenantsController, 'update'])
      .where('id', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      .use([middleware.auth(), apiThrottle])
      .as('tenants.update')

    // DELETE /api/v1/tenants/:id - Deactivate tenant
    router
      .delete('/:id', [TenantsController, 'delete'])
      .where('id', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      .use([middleware.auth(), apiThrottle])
      .as('tenants.destroy')
  })
  .prefix('/api/v1/tenants')
