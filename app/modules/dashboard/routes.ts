import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const DashboardController = () => import('#modules/dashboard/controllers/dashboard_controller')

router
  .group(() => {
    router.get('dashboard', [DashboardController, 'index']).as('index')
  })
  .as('dashboard')
  .use(middleware.auth())
  .use(middleware.tenant())
