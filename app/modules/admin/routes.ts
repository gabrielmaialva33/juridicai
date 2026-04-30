import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const HealthController = () => import('#modules/admin/controllers/health_controller')
const JobsController = () => import('#modules/admin/controllers/jobs_controller')

router
  .group(() => {
    router
      .get('admin/health', [HealthController, 'index'])
      .as('health')
      .use(middleware.permission('admin.health.read'))
    router
      .get('admin/jobs', [JobsController, 'index'])
      .as('jobs.index')
      .use(middleware.permission('admin.jobs.read'))
  })
  .as('admin')
  .use(middleware.auth())
  .use(middleware.tenant())
