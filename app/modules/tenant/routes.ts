import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const TenantSelectController = () => import('#modules/tenant/controllers/tenant_select_controller')

router
  .group(() => {
    router.get('tenants/select', [TenantSelectController, 'index']).as('select')
    router.post('tenants/select', [TenantSelectController, 'store']).as('select.store')
  })
  .as('tenants')
  .use(middleware.auth())
