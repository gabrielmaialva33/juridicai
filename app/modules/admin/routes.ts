import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const HealthController = () => import('#modules/admin/controllers/health_controller')
const JobsController = () => import('#modules/admin/controllers/jobs_controller')

router
  .group(() => {
    router.get('admin/health', [HealthController, 'index']).as('health')
    router.get('admin/jobs', [JobsController, 'index']).as('jobs.index')
  })
  .as('admin')
  .use(middleware.auth())
