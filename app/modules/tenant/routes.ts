import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const TenantSelectController = () => import('#modules/tenant/controllers/tenant_select_controller')
const SettingsController = () => import('#modules/tenant/controllers/settings_controller')

router
  .group(() => {
    router.get('tenants/select', [TenantSelectController, 'index']).as('select')
    router.post('tenants/select', [TenantSelectController, 'store']).as('select.store')
  })
  .as('tenants')
  .use(middleware.auth())

router
  .group(() => {
    router.get('settings/tenant', [SettingsController, 'tenant']).as('tenant')
    router.get('settings/users', [SettingsController, 'users']).as('users')
  })
  .as('settings')
  .use(middleware.auth())
  .use(middleware.tenant())
